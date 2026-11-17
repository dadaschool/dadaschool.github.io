# 30초 배경음악 — 다장조 주요 3화음(I-IV-V-I)으로 만든 잔잔한 곡 (연수용 예시)
# 필요한 것: 파이썬 3 + numpy.  실행: python bgm.py  →  bgm.wav (44.1 kHz, 16비트, 스테레오)
import numpy as np, wave

SR = 44100                      # 1초에 몇 번 소리를 재는지(표본 추출률)
BPM = 96                        # 빠르기: 1분에 96박
BEAT = 60 / BPM                 # 한 박 = 0.625초
BAR = 4 * BEAT                  # 4/4박자 한 마디 = 2.5초
BARS = 12                       # 12마디 × 2.5초 = 30초
T = BARS * BAR

def hz(m):                      # 미디 음 번호 → 진동수 (69번 = 라 = 440 Hz)
    return 440 * 2 ** ((m - 69) / 12)

L = np.zeros(int(SR * (T + 1))); R = np.zeros_like(L)
def add(sig, start, pan=0.0, gain=1.0):   # pan: -1 왼쪽 ~ +1 오른쪽
    i = int(round(start * SR)); n = min(len(sig), len(L) - i)
    a = (pan + 1) * np.pi / 4
    L[i:i + n] += sig[:n] * gain * np.cos(a); R[i:i + n] += sig[:n] * gain * np.sin(a)

def tt(d): return np.arange(int(SR * d)) / SR
def pad(m, d):                  # 부드럽게 깔리는 화음 소리
    t = tt(d); f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*f*1.003*t) + 0.2*np.sin(2*np.pi*2*f*t)
    return s * np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.5)
def pluck(m, d):                # 톡 튀기는 소리 (배음마다 빨리 사라짐)
    t = tt(d); f = hz(m)
    s = sum(np.sin(2*np.pi*k*f*t) * np.exp(-t * (3 + 2.5*k)) / k for k in (1, 2, 3, 4))
    return s * np.minimum(1, t / 0.004)
def bass(m, d):
    t = tt(d); f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*2*f*t)
    return s * np.minimum(1, t / 0.01) * np.exp(-t * 1.2) * np.minimum(1, (d - t) / 0.05)
def kick():
    t = tt(0.35); f = 50 + 90 * np.exp(-t * 25)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9)
rng = np.random.default_rng(2026)   # 씨앗을 정해 두면 매번 같은 곡이 나옴
def hat():
    n = rng.standard_normal(int(SR * 0.05)); n = np.diff(n, prepend=0)
    return n * np.exp(-np.arange(len(n)) / SR * 70)

# 다장조 주요 3화음: I = 도미솔(C), IV = 파라도(F), V = 솔시레(G)
CH = {'C': ([60, 64, 67], 36, [72, 76, 79]),     # (화음, 베이스, 분산화음 높은 음)
      'F': ([60, 65, 69], 41, [77, 81, 84]),
      'G': ([59, 62, 67], 43, [79, 83, 86])}
PROG = ['C', 'F', 'G', 'C'] * 3                   # 4마디 × 3번 = 12마디

for b, name in enumerate(PROG):
    t0 = b * BAR; chord, root, hi = CH[name]
    last = b == BARS - 1
    for m in chord:                                           # 화음
        add(pad(m, BAR * (1.6 if last else 1.05)), t0, 0, 0.10)
    arp = [hi[0], hi[1], hi[2], hi[0] + 12, hi[2], hi[1], hi[0], hi[1]]
    for k, m in enumerate(arp[:1] if last else arp):         # 8분음표 분산화음
        add(pluck(m, 1.2), t0 + k * BEAT / 2, -0.4 if k % 2 == 0 else 0.4, 0.07)
    if 2 <= b < BARS - 1:                                     # 3~11마디: 베이스·북
        add(bass(root, BEAT * 2), t0, 0, 0.30); add(bass(root, BEAT * 2), t0 + 2 * BEAT, 0, 0.26)
        for k in (0, 2): add(kick(), t0 + k * BEAT, 0, 0.35)
        for k in range(4): add(hat(), t0 + k * BEAT + BEAT / 2, 0.2, 0.05)
    if last:
        add(bass(root, BAR * 1.2), t0, 0, 0.30)

n = int(T * SR); st = np.stack([L[:n], R[:n]], 1)
t = np.arange(n) / SR
st *= np.minimum(1, t / 0.5)[:, None]                         # 처음 0.5초 서서히 커짐
st *= np.minimum(1, (T - t) / 2.0)[:, None]                   # 마지막 2초 서서히 작아짐
st = np.tanh(st * 1.2)                                        # 갑자기 튀는 소리 누르기
st *= 10 ** (-3 / 20) / np.abs(st).max()                      # 가장 큰 소리 = -3 dBFS
with wave.open('bgm.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('bgm.wav', round(T, 2), '초')
