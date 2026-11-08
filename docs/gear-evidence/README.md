# Trang bị: chỉ giữ trang bị, cường hóa và ghép phẩm chất

## Phạm vi

Chrome thật, các HTTP handler đăng ký/auth/save thật, DB bộ nhớ cô lập (`DB_BACKEND=memory`, `NODE_ENV=test`). Không đọc `.env`, không truy cập production hoặc MongoDB thật.

Script tạo tài khoản riêng và seed trang bị/cuộn nâng cấp vào DB thử nghiệm trước khi tải trang. Đây là kiểm chứng UI và lưu dữ liệu, không phải bằng chứng kiếm vật phẩm qua chiến đấu.

Đã bỏ xưởng, chọn bộ nhanh, tự mặc/tối ưu, mở rương từ kho, tinh luyện, khảm đá, phân rã, hoàn cấp và nâng tối đa khỏi luồng Trang bị. Không chuyển các tính năng này sang menu khác; API trình duyệt cũng không còn xuất thao tác xưởng/bộ đồ đã loại bỏ. So sánh và nội tại chỉ là dữ liệu đọc để quyết định trang bị. Một ô bảo vệ nguyên liệu ghép thay cho hai nút khóa/yêu thích, không tự gỡ bảo vệ đồ cũ.

Không xóa trường save cũ, không migration/reset dữ liệu. Normalizer giữ dòng phụ dạng `stat/value` từ máy chủ thay vì loại bỏ vì khác dạng `type/val` trên client. Không bổ sung lại chức năng chỉnh ngọc/dòng phụ.

## Kết quả

- Kho và bảng chi tiết: desktop 1024 px, mobile 390/360 px; không tràn ngang, cả sáu ô trang bị nằm trong sân khấu.
- Mobile 360 × 740: nút trang bị nằm trong viewport; Escape, nút đóng và backdrop hoạt động; Shift+Tab quay lại nút trang bị. Mở thẻ bằng Enter đã chạy thật.
- Modal chi tiết chỉ có nút đóng, Trang bị và Cường hóa; không còn nút xưởng/nâng cao và bộ nhanh trong DOM/API.
- So sánh đúng tổng chỉ số: thay nhẫn Echo bằng Destruction kế thừa cấp 5, công 214 → 204, máu 945 → 945; cảnh báo mất mốc Echo 2 món. Xem trước không đổi bộ đồ thật.
- Cường hóa cấp 5 → 6: trừ 305 vàng và 2 cuộn; không thay công thức chi phí.
- Ghép ngay trong UI: tiêu 3 món common, tạo 1 uncommon; kho 33 → 31 món, UID không trùng, không tiêu đồ đang mặc/khóa/yêu thích.
- Mở xem trước ghép nhanh rồi hủy: kho không đổi. Bảng ghép mobile nằm trong viewport, thẻ không tràn ngang.
- Đóng chi tiết giữ vị trí cuộn 793 px; đổi qua tab Anh hùng vẫn hoạt động.
- GET save xác nhận đồ mới đã ghép, nhẫn cấp 6, dữ liệu ngọc/dòng phụ trên món được bảo vệ và bộ đồ đã lưu từ trước vẫn còn. Reload xác nhận nhẫn cấp 6.
- Không có `pageerror` trong phiên kiểm chứng.

`result.json` và ảnh PNG được tạo từ lần chạy thật. Bộ kiểm mã: `npm run check` đạt (185 file, 6 script inline, 0 lỗi); `npm run test`: 474 bài, 467 đạt, 7 bỏ qua, 0 lỗi. Những bài tích hợp cần môi trường/DB riêng vẫn bỏ qua; không coi là đã kiểm chứng production.

## Chạy lại

Cần Chrome và module `playwright-core` có sẵn. Không tự cài browser/dependency.

```sh
PLAYWRIGHT_MODULE='C:/path/to/playwright-core/index.mjs' node --max-old-space-size=192 tools/verify-gear-browser.mjs
```

Kiểm RAM trước khi mở Chrome; chỉ chạy browser khi còn ít nhất 3 GB RAM trống, không chạy đồng thời với full test.

## Thử thủ công

1. Trang bị → Kho trang bị: kiểm sáu ô đang mặc và lọc từng vị trí. Không còn bộ nhanh/xưởng.
2. Chọn một món trong kho: xem tổng Công/Máu sau khi thay, cấp kế thừa và cảnh báo thay đổi bộ; đóng rồi kiểm bộ lọc/vị trí cuộn.
3. Trang bị món đó, mở lại và cường hóa: kiểm giá, vàng/cuộn bị trừ và thông báo thiếu tài nguyên khi không đủ.
4. Bấm Ghép đồ → chọn nhóm đủ nguyên liệu → Ghép ngay. Thao tác tiêu nguyên liệu, chỉ thử với đồ muốn ghép. Ghép nhanh · Xem trước → Hủy phải giữ nguyên kho.
