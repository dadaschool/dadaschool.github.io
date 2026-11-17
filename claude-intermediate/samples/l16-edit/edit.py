# 편집 기준에 따라: 조용한 구간 찾기 → 남길 구간 정하기 → 자르기 → 음량 맞추기 → 이어 붙이기
import subprocess, re, json, csv
SRC = '원본_품사설명.mp4'
NG = [(31.0, 38.0)]          # 교사가 적어 준 말 실수 구간
PAD = 0.3                    # 말 앞뒤로 남길 여유(초)
def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)
def dur(f): return float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).stdout)
D = dur(SRC)
# 1) 1초보다 긴 조용한 구간 (-40 dB 아래)
err = run(['ffmpeg','-hide_banner','-nostats','-i',SRC,'-af','silencedetect=noise=-40dB:d=1','-f','null','-']).stderr
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', err)]
en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', err)]
sil = list(zip(st, en))
# 2) 말소리 구간 = 조용한 구간의 나머지, 앞뒤 여유를 붙이고 NG 구간을 뺀다
speech, cur = [], 0.0
for a, b in sil:
    if a > cur: speech.append((cur, a))
    cur = b
if cur < D: speech.append((cur, D))
keep = []
for a, b in speech:
    a, b = max(0, a - PAD), min(D, b + PAD)
    for na, nb in NG:
        if a < nb and b > na:
            if a < na: keep.append((a, na))
            a = max(a, nb)
    if b - a > 0.5: keep.append((a, b))
# 3) 구간마다 자르기(다시 인코딩해 정확히) + 두 번 재서 음량 맞추기(-16 LUFS)
def lufs(f):
    e = run(['ffmpeg','-hide_banner','-nostats','-i',f,'-af','ebur128','-f','null','-']).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1])
rows, names = [], []
for i, (a, b) in enumerate(keep, 1):
    raw = f'clip{i:02d}_raw.mp4'; out = f'clip{i:02d}.mp4'
    run(['ffmpeg','-v','error','-y','-ss',f'{a:.2f}','-to',f'{b:.2f}','-i',SRC,'-c:v','libx264','-preset','veryfast','-crf','30','-c:a','aac','-b:a','96k',raw])
    m = run(['ffmpeg','-hide_banner','-nostats','-i',raw,'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
          f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
    run(['ffmpeg','-v','error','-y','-i',raw,'-c:v','copy','-af',af,'-c:a','aac','-b:a','96k',out])
    rows.append(dict(번호=i, 원본_시작=f'{a:.2f}', 원본_끝=f'{b:.2f}', 길이=f'{b-a:.2f}', 맞추기_전_LUFS=f'{lufs(raw):.1f}', 맞춘_뒤_LUFS=f'{lufs(out):.1f}', 파일=out))
    names.append(out)
# 4) 이어 붙이기
with open('list.txt', 'w') as f:
    for n in names: f.write(f"file '{n}'\n")
run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','list.txt','-c','copy','-movflags','+faststart','국어_품사_편집본.mp4'])
with open('국어_품사_클립목록.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print('silence', [(round(a,2), round(b,2)) for a,b in sil])
print('keep', [(round(a,2), round(b,2)) for a,b in keep])
for r in rows: print(r)
print('final', dur('국어_품사_편집본.mp4'), 'LUFS', lufs('국어_품사_편집본.mp4'))
