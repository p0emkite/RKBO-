# 츠키카드 웹 제작기 배포 준비

이 브랜치는 기존 main과 분리된 웹앱 전용 작업 브랜치입니다.

## 준비된 로컬 패키지
ChatGPT 대화에서 생성된 `츠키카드_웹제작기_GitHubPages_v1.0.zip`의 `tsuki-card-web` 폴더 내용을 이 디렉터리 안에 업로드하면 됩니다.

## 반드시 추가할 폰트
기존 데스크톱 제작기의 `assets/fonts/`에서 아래 두 파일을 복사합니다.

- `VITRO_INSPIRE.otf`
- `Freesentation-8ExtraBold.ttf`

## 목표 구조
```text
tsuki-card-web/
├─ index.html
├─ app.js
├─ py-worker.js
├─ engine.py
├─ styles.css
├─ assets/
├─ templates/
├─ config/
└─ samples/
```

GitHub Pages를 이 브랜치의 `/tsuki-card-web` 하위 폴더로 직접 지정할 수 없으므로, 실제 Pages 공개 단계에서는 이 폴더 내용을 전용 저장소 루트로 옮기거나 gh-pages 브랜치 루트에 배치하는 방식을 권장합니다.

현재 main 브랜치는 변경하지 않았습니다.
