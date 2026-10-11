import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript((ROOT / 'worker/migrations/0001_init.sql').read_text())
        self.db.execute("INSERT INTO players(id,alias,invite_code) VALUES('alice','Alice','aaaaaaaabbbb')")
        self.db.execute("INSERT INTO players(id,alias,invite_code,referrer_id) VALUES('bob','Bob','bbbbbbbbcccc','alice')")

    def view(self, who):
        return self.db.execute('SELECT water,fire,earth,wind,score,tree,light,weekly_score,streak FROM players WHERE id=?', (who,)).fetchone()

    def test_idempotent_daily_grant(self):
        for _ in range(2):
            self.db.execute("INSERT INTO grants(event_key,beneficiary_id,kind) VALUES('daily:alice:2026-10-11','alice','daily') ON CONFLICT(event_key) DO NOTHING")
        self.assertEqual(self.view('alice')[:4], (5, 5, 5, 5))

    def test_invite_reward_once(self):
        for _ in range(2):
            self.db.execute("INSERT INTO grants(event_key,beneficiary_id,kind) SELECT 'referral:' || id,referrer_id,'referral' FROM players WHERE id='bob' ON CONFLICT(event_key) DO NOTHING")
        self.assertEqual(self.view('alice')[:4], (5, 5, 5, 5))

    def test_atomic_round_replay_and_insufficient_inventory(self):
        self.db.execute("INSERT INTO grants(event_key,beneficiary_id,kind) VALUES('daily:alice:2026-10-11','alice','daily')")
        q='''INSERT INTO rounds(action_id,player_id,picked,rival,outcome,points,tree_gain,light_gain,weather_key,week_key)
        SELECT ?,id,?,?,?,?+CASE WHEN ?='win' THEN MIN(streak,2) ELSE 0 END,?,?,?,?
        FROM players WHERE id=? AND water>0 ON CONFLICT(action_id) DO NOTHING'''
        for _ in range(2):
            self.db.execute(q, ('uuid-1','water','fire','win',4,'win',0,0,'spring','2026-10-05','alice'))
        self.assertEqual(self.view('alice'),(4,5,5,5,4,0,0,4,1))
        for i in range(2,6):
            self.db.execute(q,(f'uuid-{i}','water','fire','win',4,'win',0,0,'spring','2026-10-05','alice'))
        self.assertEqual(self.view('alice')[0],0)
        self.db.execute(q,('uuid-6','water','fire','win',4,'win',0,0,'spring','2026-10-05','alice'))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM rounds').fetchone()[0],5)
        self.assertEqual(self.view('alice')[0],0)
        self.assertEqual(self.view('alice')[4],4+5+6+6+6)

    def test_synthesis_and_week_reset(self):
        self.db.execute("INSERT INTO grants(event_key,beneficiary_id,kind) VALUES('d','alice','daily')")
        self.db.execute("INSERT INTO rounds VALUES('x','alice','water','earth','loss',0,1,0,'spring','2026-10-05',CURRENT_TIMESTAMP)")
        self.db.execute("INSERT INTO rounds VALUES('y','alice','fire','wind','win',3,0,1,'ember','2026-10-12',CURRENT_TIMESTAMP)")
        self.assertEqual(self.view('alice')[5:8],(1,1,3))


if __name__ == '__main__':
    unittest.main()
