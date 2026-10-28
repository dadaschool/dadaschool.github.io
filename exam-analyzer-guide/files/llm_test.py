# 지역 LLM(LM Studio 서버)에 질문 하나 보내기 — 파이썬 기본 기능만 사용
import json
import urllib.request

SERVER = "http://localhost:1234/v1"

# 1) 서버에 불러온 모델 이름 확인
with urllib.request.urlopen(SERVER + "/models", timeout=10) as res:
    model = json.load(res)["data"][0]["id"]
print("사용할 모델:", model)

# 2) 질문 보내기
question = "중학교 서술형 평가에서 부분점수 기준을 정할 때 주의할 점 3가지를 짧게 알려 줘. /no_think"
body = {"model": model,
        "messages": [{"role": "user", "content": question}],
        "temperature": 0.4, "max_tokens": 500}
req = urllib.request.Request(SERVER + "/chat/completions",
                             data=json.dumps(body).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
print("큐웬이 답을 쓰는 중입니다. 잠시 기다리세요...")
with urllib.request.urlopen(req, timeout=900) as res:
    answer = json.load(res)
print(answer["choices"][0]["message"]["content"])
