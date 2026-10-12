# VNPT Design System — bản lưu local

Thư mục này chứa toàn bộ project docsite và các dữ liệu nguồn đã thu thập. Có thể tiếp tục sửa code, nội dung, tokens và chạy website trên laptop mà không đăng nhập ChatGPT, Figma hoặc Vercel.

Website đã xuất bản: https://vnpt-design-system.vercel.app

## Tải từ GitHub

Repository Private: `https://github.com/quctuan/design-system-docsite`. Bản GitHub chứa mã nguồn, snapshot Figma, ZIP token gốc, toàn bộ assets cần cho build, báo cáo và npm cache để build offline trên Mac. `docsite/dist/` và `backups/` được tạo lại từ các file này và không nằm trong Git vì chúng là kết quả sinh ra, có kích thước lớn.

```sh
git clone https://github.com/quctuan/design-system-docsite.git
cd design-system-docsite/docsite
npm ci --offline --cache vendor/npm-cache
npm run build
npm run check
node scripts/serve.mjs --no-build
```

Mở http://localhost:4173. Trên máy khác, nếu npm cache chưa có binary cho hệ điều hành/CPU đó, dùng `npm ci` thay cho lệnh offline. Khi cập nhật Vercel từ repo, đặt Root Directory là `docsite`.

## Nội dung đã lưu

- `docsite/src/`, `docsite/scripts/`: mã nguồn giao diện và bộ sinh website.
- `docsite/source/`: snapshot dữ liệu Figma, component specifications, styles, tokens, aliases, dữ liệu gallery và code tham chiếu.
- `docsite/public/`: toàn bộ ảnh, icons, fonts và assets local; có 1.379 ảnh gallery và 656 assets cho preview code. 40 ảnh native được giữ làm tài liệu đối chiếu.
- `docsite/dist/`: website đã build, JSON, CSS tokens, `/agents.md`, `/llms.txt` và `/llms-full.txt`.
- `sources/Design System.zip`: bản ZIP tokens gốc anh cung cấp; `sources/` cũng lưu ảnh đính kèm còn có trên máy.
- `work/`: dữ liệu xuất Figma, các bản kiểm tra và script xử lý nguồn.
- `outputs/`: báo cáo, ảnh review, kết quả kiểm tra và thông tin deployment Vercel.
- `backups/`: ZIP dự phòng khi tạo bằng `python3 tools/backup.py`; thư mục này không được commit lên GitHub.

Snapshot có 60 trang Figma, 420 token identities / 506 mode values, 2.126 components; website có 68 routes. 40 trang component có 571 variants thực tế, spec JSON và context cho iOS Swift / Android Kotlin, Java. Tất cả 571 variants có preview chạy bằng HTML/CSS/JavaScript, tab Code cùng nguồn và Copy Prompt; Usage hiển thị từng state riêng. Logo gốc anh gửi được lưu ở `sources/vnpt-app-icon.png`.

## Chạy offline trên laptop

Máy hiện có Node.js. Trên máy khác cần Node.js 20.11 trở lên; bản website đã build có thể chạy không cần npm dependencies. Build lại cần các thư viện được khóa phiên bản trong package-lock.json. Cache npm của Mac hiện tại được lưu kèm để khôi phục offline.

Mở Terminal trong thư mục này rồi chạy:

```sh
cd docsite
node scripts/serve.mjs --no-build
```

Mở http://localhost:4173. Giữ Terminal đang chạy; nhấn Control-C để dừng.

Có thể nhấp đúp `MO-DOCSITE.command` trên Mac; nếu là bản GitHub mới clone, script sẽ tự khôi phục dependencies offline và build trước khi chạy. Nếu port 4173 đang được một bản preview khác sử dụng, dừng bản đó trước.

## Tiếp tục chỉnh sửa

Sửa giao diện trong `docsite/src/`; sửa dữ liệu nội dung trong `docsite/source/`. Assets thực tế ở `docsite/public/`. Sau khi sửa:

```sh
cd docsite
npm ci --offline --cache vendor/npm-cache
npm run build
npm run check
```

Trên nền tảng khác, dùng `npm ci` nếu cache offline không chứa binary esbuild tương ứng. Các package này tải từ npm công khai, không cần tài khoản cũ.

Agent khác có thể bắt đầu bằng README này, `docsite/README.md`, `docsite/source/inventory.json` và `docsite/dist/agents.md`. Không cần tài khoản cũ để đọc hoặc sửa các file local.

## Khôi phục từ ZIP

1. Giải nén ZIP trong `backups/` vào một thư mục trên máy.
2. Mở thư mục `Design System Docsite` vừa giải nén.
3. Chạy local bằng hướng dẫn trên, hoặc tiếp tục chỉnh sửa bằng editor/agent khác.

File `.sha256` cạnh ZIP dùng kiểm tra checksum. `BACKUP-MANIFEST.json` bên trong ZIP liệt kê kích thước và SHA-256 từng file.

Để tạo ZIP mới sau các lần chỉnh sửa, chạy từ thư mục này:

```sh
python3 tools/backup.py
```

## Khi thay tài khoản hosting

Các file website và dữ liệu local đủ để deploy lên tài khoản Vercel mới hoặc một hosting hỗ trợ static website. Đăng nhập tài khoản mới, liên kết project mới và deploy từ thư mục `docsite/`; xem `docsite/README.md`.

Domain hiện tại thuộc project Vercel của tài khoản hiện tại. Nếu không còn truy cập tài khoản đó, có thể xuất bản bản local dưới URL mới.

## Phạm vi dữ liệu Figma

Dữ liệu đã lưu là snapshot dùng để làm docsite/code: văn bản, component catalogue/specifications, variables, styles, ảnh và code tham chiếu. Bản này chưa chứa file native `.fig` đầy đủ để mở lại toàn bộ thiết kế và chỉnh sửa trực tiếp trong Figma; phạm vi xuất nguồn được ghi trong `docsite/README.md` và `docsite/source/inventory.json`.
