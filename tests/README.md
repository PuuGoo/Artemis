# Tổ chức kiểm thử

- `save/`: schema, policy, repository, writer round-trip và ranh giới kiến trúc save.
- `rendering/`: factory renderer và bootstrap/load integration của game/admin trong VM.
- `fixtures/`: dữ liệu/harness tham chiếu, không tự coi là test entry point.
- Các `*.test.mjs` ở root vẫn được chạy; chuyển tiếp theo từng subsystem,
  không đổi toàn bộ đường dẫn test cùng lúc với việc tách logic.

`npm test` dùng `tools/run-tests.mjs` tìm đệ quy **chỉ** `*.test.mjs`, bỏ qua fixtures,
node_modules và symlink. Runner truyền danh sách file rõ ràng cho Node, chạy tuần tự,
heap tối đa 256 MB cho test process. Không tự chạy các audit/live tool trong thư mục này.
Các bài test môi trường thật vẫn giữ điều kiện opt-in vốn có.

Chạy nhanh một nhóm:

```bash
node --max-old-space-size=192 --test --test-concurrency=1 tests/save/*.test.mjs
node --max-old-space-size=192 --test tests/rendering/arena-renderer.test.mjs
```
