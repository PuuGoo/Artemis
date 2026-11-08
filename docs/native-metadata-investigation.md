# Điều tra tĩnh metadata IL2CPP

## Phạm vi

Chỉ đọc ba thành viên từ base.apk và split_config.arm64_v8a.apk người dùng cung cấp; không chạy APK, không attach thiết bị, không kết nối máy chủ game. Binary được giữ ở scratch, không đưa vào Git. Kết quả thô: `C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/apk-audit/native/static-findings.json`.

## Danh tính

| File | Bytes | SHA-256 |
|---|---:|---|
| global-metadata.dat | 29165824 | 7c09a4b248690dbdf23e4d64997be6b136fc4b493d0fe9d3f8acc9a43e82c7b6 |
| libil2cpp.so | 170051888 | bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3 |
| libunity.so | 23693728 | 1dab283481a22a643eecc3a201cbcee9b0276760010f136685844bd62e7d4748 |

## Quan sát

- Hai thư viện là ELF64 little-endian AArch64.
- Metadata bắt đầu bằng `da fe 57 13`, không phải magic chuẩn `af 1b b1 fa`. Không tìm thấy magic chuẩn trong toàn bộ metadata hay libil2cpp.so khi dò byte liên tiếp.
- Entropy ba cửa sổ 64 KiB của metadata tại offset 0, 14582912, 29100288 lần lượt 5.4969, 5.1939, 5.103 bit/byte. Không đủ để kết luận thuật toán mã hóa; không được coi đây là bằng chứng AES hay khóa cố định.
- Chuỗi `global-metadata.dat` có tại file offset/VA `0x19f7475` trong libil2cpp.so; không tìm thấy chuỗi này trong libunity.so.
- Quét instruction AArch64 trong section executable tìm ADRP + ADD (trong bảy instruction kế tiếp) dẫn đến địa chỉ chuỗi: một ứng viên tại VA `0x3abd928` / ADD `0x3abd92c` (file offset `0x3ab9928`). Đây là tập tham chiếu giới hạn theo mẫu, không phải toàn bộ xref.
- Sau setup chuỗi vào X0 có BL tại `0x3abd934`, đích tĩnh `0x38d2054`. Đây là ứng viên đường nạp metadata, chưa có decompile xác định nhiệm vụ callee.
- Dynamic symbol `il2cpp_init` tại `0x38faf68`, size 44; `il2cpp_init_utf16` tại `0x38faf94`, size 132.

## Giải mã và kiểm định thành công

- Cài Capstone 5.0.9 và pyelftools 0.33 vào thư mục công cụ riêng, sau đó chuyển ra scratch; không thêm dependency vào game, không thay cấu hình REA.
- Disassembly caller cho thấy sau nạp file có hàm xử lý wrapper. Đã tái hiện phép biến đổi buffer bằng mã cục bộ sinh từ các instruction được đọc; không chạy native game hay APK.
- Đầu ra `global-metadata.decoded.dat` trong thư mục scratch/native: **29165488 bytes**, SHA-256 **fd6a35437472ed8ae4247d3dd6a1c2063ac8fbd37cdba6da3e8952db00e28c43**.
- REA `inspect_il2cpp_metadata` đọc thành công magic chuẩn và metadata **version 31**: 31 section, 161 image/assembly, 32112 type, 247853 method, 146571 field, 41070 property, 491 event, 217252 parameter, 39621 string literal.
- Evidence gốc: `ev_7b5f1c45f3a54b23630a3eed9fc2609be48d6eff26fa02ef17f4d6e5368b0890`. Summary: `ev_6cae467bca0c6c7e15894ba04224d2f78c875e99c2276507fd0da44b2bc035e5`.
- File nguồn giữ nguyên, output và disassembly nằm ngoài repository. Không công bố binary/metadata phục hồi trong Git.

## Phần chưa khôi phục

- Metadata cung cấp tên/chủ sở hữu/chỉ mục, không cung cấp thân hàm C# gốc. Chưa khôi phục công thức sát thương, AI, cân bằng hoặc drop.
- Chưa liên kết các method với địa chỉ native; cần bước registration/address mapping và phân tích thân hàm có mục tiêu.
- REA chưa có decompiler native khả dụng. Không chạy whole-program analysis trên thư viện 170 MB ở máy RAM 8 GB.
- Tên hàm, tên field hay chuỗi không tự chứng minh công thức gameplay hoặc hành vi runtime. Logic phía server có thể không nằm trong APK.
