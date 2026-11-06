using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Artemis.Domain.Core
{
    public enum JsonKind { Null, Bool, Number, String, Array, Object }

    /// <summary>
    /// DOM JSON tối giản, không phụ thuộc package ngoài.
    ///
    /// Vì sao tự viết thay vì System.Text.Json / Newtonsoft:
    ///   • Unity 2022.3 chỉ có Newtonsoft qua package, không mặc định.
    ///   • netstandard2.1 không có System.Text.Json.
    ///   • Cần quyền kiểm soát tuyệt đối cách ghi số, để save round-trip không
    ///     đổi giá trị (1.7e12 phải ghi lại thành 1700000000000, không phải 1.7E+12).
    ///
    /// Chỉ hỗ trợ đúng những gì save của Artemis dùng: null, bool, number,
    /// string, array, object. Không comment, không trailing comma (đúng JSON).
    /// </summary>
    public sealed class JsonValue
    {
        public JsonKind Kind { get; private set; }
        public bool BoolValue { get; private set; }
        public double NumberValue { get; private set; }
        public string StringValue { get; private set; }
        public List<JsonValue> Items { get; private set; }
        public Dictionary<string, JsonValue> Members { get; private set; }

        public static readonly JsonValue Null = new JsonValue { Kind = JsonKind.Null };

        private JsonValue() { }

        public static JsonValue Bool(bool v) => new JsonValue { Kind = JsonKind.Bool, BoolValue = v };
        public static JsonValue Number(double v) => new JsonValue { Kind = JsonKind.Number, NumberValue = v };
        public static JsonValue Str(string v) => new JsonValue { Kind = JsonKind.String, StringValue = v ?? string.Empty };
        public static JsonValue Array() => new JsonValue { Kind = JsonKind.Array, Items = new List<JsonValue>() };
        public static JsonValue Object() => new JsonValue { Kind = JsonKind.Object, Members = new Dictionary<string, JsonValue>(StringComparer.Ordinal) };

        public bool IsNull => Kind == JsonKind.Null;
        public bool IsObject => Kind == JsonKind.Object;
        public bool IsArray => Kind == JsonKind.Array;
        public bool IsNumber => Kind == JsonKind.Number;

        // ---------- Truy cập an toàn (không ném lỗi) ----------

        public JsonValue this[string key]
        {
            get
            {
                if (Kind != JsonKind.Object) return Null;
                return Members.TryGetValue(key, out var v) ? v : Null;
            }
            set
            {
                if (Kind != JsonKind.Object) throw new InvalidOperationException("JsonValue không phải object.");
                Members[key] = value ?? Null;
            }
        }

        public JsonValue this[int index]
        {
            get
            {
                if (Kind != JsonKind.Array) return Null;
                return index >= 0 && index < Items.Count ? Items[index] : Null;
            }
        }

        public int Count => Kind == JsonKind.Array ? Items.Count : (Kind == JsonKind.Object ? Members.Count : 0);
        public bool Has(string key) => Kind == JsonKind.Object && Members.ContainsKey(key);

        public double AsNumber(double fallback = 0)
        {
            if (Kind == JsonKind.Number) return NumberValue;
            if (Kind == JsonKind.Bool) return BoolValue ? 1 : 0;
            return fallback;
        }

        public int AsInt(int fallback = 0)
        {
            double d = AsNumber(double.NaN);
            if (double.IsNaN(d) || double.IsInfinity(d)) return fallback;
            return JsMath.RoundInt(d);
        }

        public bool AsBool(bool fallback = false)
        {
            if (Kind == JsonKind.Bool) return BoolValue;
            if (Kind == JsonKind.Number) return NumberValue != 0;
            return fallback;
        }

        public string AsString(string fallback = null)
        {
            if (Kind == JsonKind.String) return StringValue;
            if (Kind == JsonKind.Number) return Json.WriteNumber(NumberValue);
            if (Kind == JsonKind.Bool) return BoolValue ? "true" : "false";
            return fallback;
        }

        public JsonValue Get(string key) => this[key];

        public JsonValue Set(string key, JsonValue value)
        {
            this[key] = value;
            return this;
        }

        public JsonValue Set(string key, double value) => Set(key, Number(value));
        public JsonValue Set(string key, string value) => Set(key, Str(value));
        public JsonValue Set(string key, bool value) => Set(key, Bool(value));

        public IEnumerable<KeyValuePair<string, JsonValue>> Entries()
        {
            if (Kind != JsonKind.Object) yield break;
            foreach (var kv in Members) yield return kv;
        }

        /// <summary>Sao chép sâu — cần cho so sánh và cho rollback.</summary>
        public JsonValue Clone()
        {
            switch (Kind)
            {
                case JsonKind.Null: return Null;
                case JsonKind.Bool: return Bool(BoolValue);
                case JsonKind.Number: return Number(NumberValue);
                case JsonKind.String: return Str(StringValue);
                case JsonKind.Array:
                    var a = Array();
                    foreach (var it in Items) a.Items.Add(it.Clone());
                    return a;
                case JsonKind.Object:
                    var o = Object();
                    foreach (var kv in Members) o.Members[kv.Key] = kv.Value.Clone();
                    return o;
                default: return Null;
            }
        }

        public override string ToString() => Json.Write(this);
    }

    public sealed class JsonParseException : Exception
    {
        public JsonParseException(string message) : base(message) { }
    }

    public static class Json
    {
        public static JsonValue Parse(string text)
        {
            if (text == null) throw new JsonParseException("JSON null input");
            var p = new Parser(text);
            p.SkipWs();
            var v = p.ParseValue(0);
            p.SkipWs();
            if (!p.AtEnd) throw new JsonParseException("Ký tự thừa sau JSON tại vị trí " + p.Index);
            return v;
        }

        /// <summary>Parse không ném lỗi; trả null nếu hỏng. Dùng cho dữ liệu từ mạng.</summary>
        public static JsonValue TryParse(string text)
        {
            try { return Parse(text); }
            catch { return null; }
        }

        public static string Write(JsonValue v, bool pretty = false)
        {
            var sb = new StringBuilder(1024);
            WriteValue(sb, v, pretty, 0);
            return sb.ToString();
        }

        /// <summary>
        /// Ghi số giống <c>JSON.stringify</c>: dạng ngắn nhất, không mũ khi
        /// |v| &lt; 1e21, số nguyên không có ".0".
        /// </summary>
        public static string WriteNumber(double v)
        {
            if (double.IsNaN(v) || double.IsInfinity(v)) return "0"; // JSON.stringify(NaN) === "null"; save dùng 0 an toàn hơn
            if (v == 0.0) return "0";

            bool integral = Math.Floor(v) == v;
            if (integral && Math.Abs(v) < 1e15)
                return ((long)v).ToString(CultureInfo.InvariantCulture);

            // .NET Core 3.0+ dùng "shortest round-trippable" giống JS.
            string s = v.ToString("R", CultureInfo.InvariantCulture);
            if (integral && s.IndexOf('E') >= 0)
            {
                // 1E+21 -> 1e+21 (JS viết lowercase, và only dùng mũ khi >= 1e21)
                s = s.Replace("E", "e");
            }
            return s;
        }

        private static void WriteValue(StringBuilder sb, JsonValue v, bool pretty, int depth)
        {
            if (v == null) { sb.Append("null"); return; }
            switch (v.Kind)
            {
                case JsonKind.Null: sb.Append("null"); break;
                case JsonKind.Bool: sb.Append(v.BoolValue ? "true" : "false"); break;
                case JsonKind.Number: sb.Append(WriteNumber(v.NumberValue)); break;
                case JsonKind.String: WriteString(sb, v.StringValue); break;
                case JsonKind.Array:
                    sb.Append('[');
                    for (int i = 0; i < v.Items.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        if (pretty) { sb.Append('\n'); sb.Append(' ', (depth + 1) * 2); }
                        WriteValue(sb, v.Items[i], pretty, depth + 1);
                    }
                    if (pretty && v.Items.Count > 0) { sb.Append('\n'); sb.Append(' ', depth * 2); }
                    sb.Append(']');
                    break;
                case JsonKind.Object:
                    sb.Append('{');
                    bool first = true;
                    foreach (var kv in v.Members)
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        if (pretty) { sb.Append('\n'); sb.Append(' ', (depth + 1) * 2); }
                        WriteString(sb, kv.Key);
                        sb.Append(':');
                        if (pretty) sb.Append(' ');
                        WriteValue(sb, kv.Value, pretty, depth + 1);
                    }
                    if (pretty && !first) { sb.Append('\n'); sb.Append(' ', depth * 2); }
                    sb.Append('}');
                    break;
            }
        }

        private static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            if (s != null)
            {
                foreach (char c in s)
                {
                    switch (c)
                    {
                        case '"': sb.Append("\\\""); break;
                        case '\\': sb.Append("\\\\"); break;
                        case '\b': sb.Append("\\b"); break;
                        case '\f': sb.Append("\\f"); break;
                        case '\n': sb.Append("\\n"); break;
                        case '\r': sb.Append("\\r"); break;
                        case '\t': sb.Append("\\t"); break;
                        default:
                            if (c < 0x20)
                                sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                            else
                                sb.Append(c);
                            break;
                    }
                }
            }
            sb.Append('"');
        }

        private sealed class Parser
        {
            private readonly string _s;
            private int _i;
            private int _depth;

            public Parser(string s) { _s = s; _i = 0; }
            public int Index => _i;
            public bool AtEnd => _i >= _s.Length;

            public void SkipWs()
            {
                while (_i < _s.Length)
                {
                    char c = _s[_i];
                    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') _i++;
                    else break;
                }
            }

            public JsonValue ParseValue(int depth)
            {
                if (depth > 200) throw new JsonParseException("JSON lồng quá sâu");
                SkipWs();
                if (AtEnd) throw new JsonParseException("JSON kết thúc đột ngột");
                char c = _s[_i];
                switch (c)
                {
                    case '{': return ParseObject(depth);
                    case '[': return ParseArray(depth);
                    case '"': return JsonValue.Str(ParseString());
                    case 't':
                        Expect("true"); return JsonValue.Bool(true);
                    case 'f':
                        Expect("false"); return JsonValue.Bool(false);
                    case 'n':
                        Expect("null"); return JsonValue.Null;
                    default:
                        return ParseNumber();
                }
            }

            private void Expect(string lit)
            {
                if (_i + lit.Length > _s.Length || string.CompareOrdinal(_s, _i, lit, 0, lit.Length) != 0)
                    throw new JsonParseException("Mong đợi '" + lit + "' tại " + _i);
                _i += lit.Length;
            }

            private JsonValue ParseObject(int depth)
            {
                _i++; // {
                var obj = JsonValue.Object();
                SkipWs();
                if (!AtEnd && _s[_i] == '}') { _i++; return obj; }
                while (true)
                {
                    SkipWs();
                    if (AtEnd || _s[_i] != '"') throw new JsonParseException("Khoá object phải là chuỗi tại " + _i);
                    string key = ParseString();
                    SkipWs();
                    if (AtEnd || _s[_i] != ':') throw new JsonParseException("Thiếu ':' tại " + _i);
                    _i++;
                    obj.Members[key] = ParseValue(depth + 1);
                    SkipWs();
                    if (AtEnd) throw new JsonParseException("Object chưa đóng");
                    if (_s[_i] == ',') { _i++; continue; }
                    if (_s[_i] == '}') { _i++; return obj; }
                    throw new JsonParseException("Mong đợi ',' hoặc '}' tại " + _i);
                }
            }

            private JsonValue ParseArray(int depth)
            {
                _i++; // [
                var arr = JsonValue.Array();
                SkipWs();
                if (!AtEnd && _s[_i] == ']') { _i++; return arr; }
                while (true)
                {
                    arr.Items.Add(ParseValue(depth + 1));
                    SkipWs();
                    if (AtEnd) throw new JsonParseException("Array chưa đóng");
                    if (_s[_i] == ',') { _i++; continue; }
                    if (_s[_i] == ']') { _i++; return arr; }
                    throw new JsonParseException("Mong đợi ',' hoặc ']' tại " + _i);
                }
            }

            private string ParseString()
            {
                _i++; // "
                var sb = new StringBuilder();
                while (true)
                {
                    if (AtEnd) throw new JsonParseException("Chuỗi chưa đóng");
                    char c = _s[_i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (AtEnd) throw new JsonParseException("Escape không hoàn chỉnh");
                    char e = _s[_i++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (_i + 4 > _s.Length) throw new JsonParseException("\\u thiếu 4 ký tự hex");
                            sb.Append((char)int.Parse(_s.Substring(_i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            _i += 4;
                            break;
                        default: throw new JsonParseException("Escape lạ '\\" + e + "'");
                    }
                }
            }

            private JsonValue ParseNumber()
            {
                int start = _i;
                if (_i < _s.Length && (_s[_i] == '-' || _s[_i] == '+')) _i++;
                while (_i < _s.Length)
                {
                    char c = _s[_i];
                    if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') _i++;
                    else break;
                }
                if (_i == start) throw new JsonParseException("Số không hợp lệ tại " + start);
                string tok = _s.Substring(start, _i - start);
                if (!double.TryParse(tok, NumberStyles.Float, CultureInfo.InvariantCulture, out double d))
                    throw new JsonParseException("Không parse được số '" + tok + "'");
                return JsonValue.Number(d);
            }
        }
    }
}
