using System;
using System.Collections.Generic;
using Artemis.Domain.Core;

namespace Artemis.Domain.Persistence
{
    public enum SaveLoadError
    {
        None = 0,
        NotAnObject,
        UnsupportedVersion,
        Malformed,
    }

    public struct SaveLoadResult
    {
        public SaveLoadError Error;
        public string Message;
        public JsonValue Data;
        /// <summary>Phiên bản save gốc đã đọc (trước khi migrate).</summary>
        public int SourceVersion;
        public bool Ok => Error == SaveLoadError.None;
    }

    /// <summary>
    /// Nạp / ghi save với lớp tương thích phiên bản.
    ///
    /// NGUYÊN TẮC: save là dữ liệu của NGƯỜI CHƠI. Không được đổi tên field,
    /// không được bỏ field lạ, không được "chuẩn hoá" giá trị. Server
    /// (<c>lib/saveSchema.js</c>) mới là nơi quyết định field nào được giữ; client
    /// chỉ được đọc và ghi lại nguyên vẹn những gì đã nhận.
    ///
    /// Vì vậy lớp này cố ý KHÔNG ánh xạ save sang POCO có kiểu cứng: một POCO sẽ
    /// làm mất mọi field chưa khai báo, và lần ghi kế tiếp sẽ xoá sạch dữ liệu đó
    /// trên server (server upsert cả document).
    /// </summary>
    public static class SaveSerializer
    {
        /// <summary>Phiên bản save hiện tại mà client hiểu đầy đủ.</summary>
        public const int CurrentVersion = 1;

        /// <summary>Kích thước tối đa server chấp nhận (lib/saveSchema.js).</summary>
        public const int MaxSaveBytes = 400 * 1024;

        /// <summary>Các field đánh dấu phiên bản — thiếu chúng, SaveState.load() coi là save cũ.</summary>
        public static readonly string[] VersionFields =
        {
            "maxedAllVersion", "artemisHeroVersion", "wikiCharactersVersion"
        };

        public static SaveLoadResult Load(string json)
        {
            if (string.IsNullOrEmpty(json))
                return new SaveLoadResult { Error = SaveLoadError.Malformed, Message = "Save rỗng." };

            var v = Json.TryParse(json);
            if (v == null)
                return new SaveLoadResult { Error = SaveLoadError.Malformed, Message = "Save không phải JSON hợp lệ." };

            if (!v.IsObject)
                return new SaveLoadResult { Error = SaveLoadError.NotAnObject, Message = "Save phải là object." };

            int sourceVersion = v["saveVersion"].AsInt(0);

            // Save rất cũ (trước khi có version) vẫn phải nạp được: bản web cũng
            // chấp nhận và tự áp default. Không từ chối.
            var migrated = Migrate(v, sourceVersion);

            return new SaveLoadResult
            {
                Error = SaveLoadError.None,
                Data = migrated,
                SourceVersion = sourceVersion,
            };
        }

        public static SaveLoadResult LoadFromDisk(string path, Func<string, string> readTextFile)
        {
            string json = readTextFile(path);
            return Load(json);
        }

        /// <summary>
        /// Nâng save cũ lên phiên bản hiện tại. KHÔNG xoá field, chỉ THÊM default
        /// khi thiếu — đúng như SaveState.load() của bản web.
        ///
        /// Chỉ thêm những field NẰM TRONG WHITELIST của server. Thêm một field
        /// ngoài whitelist (ví dụ artifactStars) sẽ khiến lần ghi kế tiếp đẩy lên
        /// một document trông như "đã bị xoá" — đúng loại mất dữ liệu mà migration
        /// này phải tránh.
        /// </summary>
        private static JsonValue Migrate(JsonValue save, int sourceVersion)
        {
            var data = save;

            // Ba field version: bản web ghi mặc định 1/1/2 khi thiếu, để không
            // kích hoạt nhánh "save cũ quá" (nhánh đó từng tặng full tài nguyên).
            foreach (var f in VersionFields)
            {
                if (!data.Has(f))
                {
                    int def = f == "wikiCharactersVersion" ? 2 : 1;
                    data.Set(f, def);
                }
            }

            if (!data.Has("gold")) data.Set("gold", 0);
            if (!data.Has("gems")) data.Set("gems", 0);
            if (!data.Has("gearLevel")) data.Set("gearLevel", 1);
            if (!data.Has("selectedHeroId")) data.Set("selectedHeroId", "alex");
            if (!data.Has("selectedWeaponId")) data.Set("selectedWeaponId", "bow");
            if (!data.Has("selectedPetId")) data.Set("selectedPetId", "spirit_sword");
            if (!data.Has("selectedChapterIdx")) data.Set("selectedChapterIdx", 0);
            if (!data.Has("heroStars")) data.Set("heroStars", JsonValue.Object());
            // KHÔNG thêm artifactStars mặc định: field này nằm ngoài whitelist của
            // server, nên nếu client tự tạo `{}` rồi ghi lại, mỗi lần lưu sẽ đẩy
            // lên một save "không có artifact" — và khi whitelist được sửa, dữ liệu
            // thật (nếu còn) sẽ bị ghi đè bằng rỗng. Thiếu thì để thiếu.
            if (!data.Has("talents")) data.Set("talents", JsonValue.Object());
            if (!data.Has("runes")) data.Set("runes", JsonValue.Object());
            if (!data.Has("unlockedSkins")) data.Set("unlockedSkins", JsonValue.Object());
            if (!data.Has("heroSelectedSkins")) data.Set("heroSelectedSkins", JsonValue.Object());
            if (!data.Has("equippedGear")) data.Set("equippedGear", JsonValue.Object());
            if (!data.Has("gearBag")) data.Set("gearBag", JsonValue.Array());
            if (!data.Has("bestRooms")) data.Set("bestRooms", JsonValue.Object());
            if (!data.Has("winsByChapter")) data.Set("winsByChapter", JsonValue.Object());
            if (!data.Has("lifetimeStats")) data.Set("lifetimeStats", JsonValue.Object());

            return data;
        }

        /// <summary>
        /// Ghi save để gửi lên server. Trả về JSON + số byte.
        ///
        /// Không thêm field nội bộ nào (ví dụ <c>saveVersion</c> chỉ được thêm khi
        /// được server whitelist — hiện chưa, nên KHÔNG ghi).
        /// </summary>
        public static string Serialize(JsonValue save, out int byteCount)
        {
            if (save == null) save = JsonValue.Object();
            string text = Json.Write(save);
            byteCount = System.Text.Encoding.UTF8.GetByteCount(text);
            return text;
        }

        /// <summary>Kiểm tra kích thước trước khi gửi — server trả 422 nếu vượt.</summary>
        public static bool IsWithinServerLimit(JsonValue save, out int byteCount)
        {
            Serialize(save, out byteCount);
            return byteCount <= MaxSaveBytes;
        }

        /// <summary>
        /// So sánh hai save để biết có gì cần gửi hay không (bản web dùng hash).
        /// So sánh theo JSON đã chuẩn hoá nên thứ tự key không ảnh hưởng.
        /// </summary>
        public static bool ContentEquals(JsonValue a, JsonValue b)
        {
            return JsonEquals(a, b, 0);
        }

        private static bool JsonEquals(JsonValue a, JsonValue b, int depth)
        {
            if (depth > 50) return false;
            if (a == null || a.IsNull) return b == null || b.IsNull;
            if (b == null || b.IsNull) return false;
            if (a.Kind != b.Kind) return false;

            switch (a.Kind)
            {
                case JsonKind.Bool: return a.BoolValue == b.BoolValue;
                case JsonKind.Number: return a.NumberValue.Equals(b.NumberValue);
                case JsonKind.String: return a.StringValue == b.StringValue;
                case JsonKind.Array:
                    if (a.Count != b.Count) return false;
                    for (int i = 0; i < a.Count; i++)
                        if (!JsonEquals(a.Items[i], b.Items[i], depth + 1)) return false;
                    return true;
                case JsonKind.Object:
                    if (a.Count != b.Count) return false;
                    foreach (var kv in a.Entries())
                    {
                        if (!b.Has(kv.Key)) return false;
                        if (!JsonEquals(kv.Value, b[kv.Key], depth + 1)) return false;
                    }
                    return true;
                default: return true;
            }
        }
    }

    public enum RevisionOutcome
    {
        Accepted,
        Conflict,
        Rejected,
    }

    /// <summary>Kết quả PUT /api/save mà tầng mạng trả về.</summary>
    public struct SavePushResult
    {
        public int HttpStatus;
        public bool Ok;
        public bool Conflict;
        public int ServerRevision;
        public string ErrorCode;
        public string ErrorMessage;
        public JsonValue ServerData;
    }

    /// <summary>
    /// Quyết định phải làm gì với phản hồi PUT /api/save.
    ///
    /// Tách khỏi tầng mạng để test được mà không cần HTTP: đây là chỗ dễ làm mất
    /// dữ liệu người chơi nhất (ghi đè nhầm khi 409, hoặc gửi lại mù khi 422).
    /// </summary>
    public static class SavePushPolicy
    {
        public const int StatusOk = 200;
        public const int StatusConflict = 409;
        public const int StatusUnprocessable = 422;
        public const int StatusUnauthorized = 401;
        public const int StatusRateLimited = 429;

        /// <summary>
        /// Đọc phản hồi thành quyết định. Không có nhánh nào được phép "thử lại
        /// ngay" khi 409/422 — đó là cách ghi đè dữ liệu của thiết bị khác.
        /// </summary>
        public static SavePushResult Interpret(int httpStatus, JsonValue body)
        {
            var r = new SavePushResult { HttpStatus = httpStatus, Ok = false };
            if (body == null) body = JsonValue.Object();

            r.ServerRevision = body["revision"].AsInt(0);
            r.ErrorCode = body["code"].AsString(null);
            r.ErrorMessage = body["error"].AsString(null);

            bool ok = body["ok"].AsBool(false);
            if (httpStatus == StatusOk && ok)
            {
                r.Ok = true;
                return r;
            }

            if (httpStatus == StatusConflict || body["conflict"].AsBool(false))
            {
                r.Conflict = true;
                r.ServerRevision = body["serverRevision"].AsInt(r.ServerRevision);
                var serverData = body["serverData"];
                if (serverData.IsObject) r.ServerData = serverData;
                return r;
            }

            // 422 kinh tế/season: server gửi kèm bản ghi hiện tại để client KHÔNG
            // ghi đè dữ liệu hỏng lên máy.
            if (httpStatus == StatusUnprocessable)
            {
                var serverData = body["serverData"];
                if (serverData.IsObject)
                {
                    r.ServerData = serverData;
                    r.ServerRevision = body["serverRevision"].AsInt(r.ServerRevision);
                }
                return r;
            }

            return r;
        }

        /// <summary>
        /// Có nên thử lại tự động không. Chỉ 429 và 5xx là đáng thử; 4xx còn lại là
        /// lỗi logic của client, thử lại chỉ tốn pin và làm nặng server.
        /// </summary>
        public static bool ShouldRetry(int httpStatus, int attempt)
        {
            if (attempt >= 3) return false;
            if (httpStatus == StatusRateLimited) return true;
            return httpStatus >= 500 && httpStatus <= 599;
        }

        /// <summary>Thời gian chờ trước lần thử lại (giây): backoff mũ, chặn trên 30s.</summary>
        public static double RetryDelaySeconds(int attempt)
        {
            double d = Math.Pow(2, Math.Max(0, attempt));
            return Math.Min(30.0, d);
        }
    }
}
