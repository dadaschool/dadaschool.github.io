# SQLite 데이터베이스 맛보기 — 파이썬 기본 기능만 사용 (가상 학번·가상 점수)
import sqlite3
from pathlib import Path

db_file = Path.home() / "practice.db"          # 예: C:\Users\내이름\practice.db
con = sqlite3.connect(db_file)

# 1) 표(테이블) 만들기: 학번 + 문항 번호가 겹치면 안 됨(기본 키)
con.execute("""CREATE TABLE IF NOT EXISTS scores(
                 sid TEXT, item INTEGER, score REAL,
                 PRIMARY KEY(sid, item))""")

# 2) 행(레코드) 넣기 — 같은 학번·문항이면 새 값으로 바꿈
rows = [("10101", 1, 4), ("10101", 2, 2.5),
        ("10102", 1, 3), ("10102", 2, 1),
        ("10103", 1, 2), ("10103", 2, 3)]
con.executemany("INSERT OR REPLACE INTO scores VALUES(?, ?, ?)", rows)
con.commit()

# 3) 질문(쿼리)하기 — 문항별 평균과 학생 수
print("문항, 평균 점수, 학생 수")
for row in con.execute("SELECT item, ROUND(AVG(score), 2), COUNT(*) FROM scores GROUP BY item"):
    print(row)

con.close()
print("저장한 파일:", db_file)
