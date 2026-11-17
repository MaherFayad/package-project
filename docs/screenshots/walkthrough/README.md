# Walkthrough video

`elba-walkthrough.mp4` (4 min 6 s, 1280 x 800, English): a brand uploads its own printer's dieline, Elba recognises the Gift box (tuck front), the brand sets the lid to 26 cm, signs up with a mobile number, checks out and pays with the test card; the printer accepts, starts production and sends QC photos; ops approve QC and book the courier; the brand sees the order delivered and opens the receipt. Recorded 2026-11-16 on a local production build.

Re-record:
1. Fresh database: `rm -f prisma/video.db*; export ELBA_DATABASE_URL=file:./video.db; npx prisma db push && npx prisma db seed`, then `npm run build`.
2. `WALK_OUT=/tmp/walk OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 npx playwright test e2e/walkthrough.spec.ts --project=desktop --trace off` (the spec skips itself without `WALK_OUT`).
3. Join the four clips:
   `ffmpeg -i 1-buyer.webm -i 2-printer.webm -i 3-ops.webm -i 4-delivered.webm -filter_complex "[0:v]fps=25,setsar=1[a];[1:v]fps=25,setsar=1[b];[2:v]fps=25,setsar=1[c];[3:v]fps=25,setsar=1[d];[a][b][c][d]concat=n=4:v=1:a=0,format=yuv420p[v]" -map "[v]" -c:v libx264 -preset slow -crf 26 -movflags +faststart elba-walkthrough.mp4`

## Owner's recording, edited

`elba-walkthrough-owner-edit.mp4` (2 min 5 s, 1920 x 956): the owner's own screen recording of the demo (4 min 32 s, "Recording 2026-11-16 221434.mp4" on Drive) cut to the happy path. Removed: the system file picker, loading skeletons, the first payment attempt (Fawry, then card, then a second checkout), the account page and sign-out, the home and printers pages, the browser's address-autofill pop-ups, the mistyped printer phone, and a second job opened by mistake. Slow parts (catalogue search, 3D turning, checkout scrolling) play at 1.25x to 1.5x. Captions name each step; title cards open the brand and printer parts. Cut list and render: `tools/edit-owner-recording.py` (expects the source at `src/rec.mp4` beside it).
