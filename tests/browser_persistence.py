"""Integration checks against real Chromium IndexedDB; run with Vite already started."""
import json
import os
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('HARD_SHIP_TEST_URL', 'http://127.0.0.1:5173/')
READ_WORLD = "async () => JSON.parse(JSON.stringify((await import('/src/core/world.ts')).state))"

class PersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.open(self.page)
        self.page.get_by_role('button', name='Ⅱ', exact=True).click()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open(self, page):
        page.goto(URL)
        page.get_by_role('heading', name='PARTIE SOLO', exact=True).wait_for()
        page.locator('canvas').wait_for()

    def save(self):
        self.page.get_by_role('button', name='Sauvegarder', exact=True).click()
        self.page.get_by_text('Partie sauvegardée', exact=True).wait_for()

    def test_round_trip_export_import_and_rejection(self):
        page = self.page
        page.get_by_label('Membre affecté').select_option('maya')
        expected = page.evaluate(READ_WORLD)
        self.assertTrue(expected['crew'][0]['path'])
        self.save()
        stores = page.evaluate("""async () => {
          const {openDatabase}=await import('/src/persistence/database.ts');const db=await openDatabase();
          const names=[...db.objectStoreNames];db.close();return names;
        }""")
        self.assertEqual(stores, ['crew','installations','resources','rooms','world'])
        page.reload()
        page.get_by_role('heading', name='PARTIE SOLO', exact=True).wait_for()
        self.assertEqual(page.evaluate(READ_WORLD), expected)
        with page.expect_download() as download:
            page.get_by_role('button', name='Exporter', exact=True).click()
        exported = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(exported['world'], expected)
        page.get_by_label('Membre affecté').select_option('idris')
        page.locator('input[type=file]').set_input_files({
            'name':'partie.json','mimeType':'application/json','buffer':json.dumps(exported).encode()})
        page.get_by_text('Partie importée et sauvegardée', exact=True).wait_for()
        self.assertEqual(page.evaluate(READ_WORLD), expected)
        self.assertEqual(page.locator('canvas').count(), 1)
        for invalid in [dict(exported,version=999), {'format':'wrong'}]:
            page.locator('input[type=file]').set_input_files({
                'name':'invalide.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
            page.get_by_text('Import impossible :', exact=False).wait_for()
            self.assertEqual(page.evaluate(READ_WORLD), expected)
        page.reload()
        page.get_by_role('heading', name='PARTIE SOLO', exact=True).wait_for()
        self.assertEqual(page.evaluate(READ_WORLD), expected)

    def test_automatic_save_hidden_freeze_and_close_checkpoint(self):
        page = self.page
        page.get_by_label('Membre affecté').select_option('maya')
        expected = page.evaluate(READ_WORLD)
        page.wait_for_timeout(2300)
        stored = page.evaluate("""async () => {
          const {openDatabase,loadGame}=await import('/src/persistence/database.ts');
          const db=await openDatabase();const save=await loadGame(db);db.close();return save.world;
        }""")
        self.assertEqual(stored, expected)
        page.get_by_role('button', name='×4', exact=True).click()
        page.evaluate("""() => {
          Object.defineProperty(document,'hidden',{configurable:true,value:true});
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        frozen=page.evaluate(READ_WORLD)
        page.wait_for_timeout(1200)
        self.assertEqual(page.evaluate(READ_WORLD), frozen)
        # Close while speed is ×4; a synchronous checkpoint must retain the exact state.
        page.close()
        page=self.context.new_page()
        page.add_init_script("Object.defineProperty(document,'hidden',{configurable:true,value:true})")
        self.open(page)
        self.assertEqual(page.evaluate(READ_WORLD), frozen)
        self.page=page

    def test_second_tab_cannot_overwrite_world(self):
        self.save()
        second=self.context.new_page()
        second.goto(URL)
        second.get_by_role('alert').wait_for()
        self.assertIn('déjà ouverte', second.locator('body').inner_text())
        self.assertEqual(second.locator('canvas').count(), 0)
        second.close()

    def test_transaction_failure_rolls_back_and_corrupt_data_is_preserved(self):
        self.save()
        result=self.page.evaluate("""async () => {
          const {openDatabase,loadGame,saveGame}=await import('/src/persistence/database.ts');
          const db=await openDatabase(),before=await loadGame(db);
          const changed=structuredClone(before);changed.world.food=1;
          const original=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){
            if(this.name==='resources')throw new DOMException('Test failure','QuotaExceededError');
            return original.apply(this,args);
          };
          let failed=false;
          try{await saveGame(db,changed);}catch{failed=true;}
          finally{IDBObjectStore.prototype.put=original;}
          const after=await loadGame(db);db.close();return {failed,before,after};
        }""")
        self.assertTrue(result['failed'])
        self.assertEqual(result['before'], result['after'])
        self.page.evaluate("""async () => {
          const {openDatabase}=await import('/src/persistence/database.ts');const db=await openDatabase();
          await new Promise((resolve,reject)=>{
            const tx=db.transaction('resources','readwrite');
            tx.objectStore('resources').put({id:'food',amount:-42,capacity:100});
            tx.oncomplete=resolve;tx.onerror=reject;
          });db.close();localStorage.removeItem('hard-ship-checkpoint-v1');
        }""")
        self.page.reload()
        self.page.get_by_role('alert').wait_for()
        self.assertEqual(self.page.locator('canvas').count(),0)
        amount=self.page.evaluate("""async () => {
          const {openDatabase}=await import('/src/persistence/database.ts');const db=await openDatabase();
          const row=await new Promise(resolve=>{
            const request=db.transaction('resources').objectStore('resources').get('food');
            request.onsuccess=()=>resolve(request.result);
          });db.close();return row.amount;
        }""")
        self.assertEqual(amount,-42)
        # A valid backup remains usable from the blocked startup screen.
        self.page.locator('input[type=file]').set_input_files({
            'name':'recovery.json','mimeType':'application/json',
            'buffer':json.dumps(result['before']).encode()})
        self.page.get_by_role('heading', name='PARTIE SOLO', exact=True).wait_for()
        self.assertEqual(self.page.evaluate(READ_WORLD), result['before']['world'])

if __name__ == '__main__':
    unittest.main(verbosity=2)
