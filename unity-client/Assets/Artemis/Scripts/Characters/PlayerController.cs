using System;
using Artemis.Runtime.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Artemis.Runtime.Characters
{
    /// <summary>
    /// Di chuyển nhân vật — port của phần movement trong <c>updateGame()</c>
    /// (public/index.html:28201).
    ///
    /// Ba hành vi phải giữ đúng:
    /// <list type="number">
    /// <item>Vector 8 hướng được CHUẨN HOÁ — đi chéo không nhanh hơn (web dùng
    ///       <c>len = hypot(mx,my)</c> trước khi nhân tốc độ).</item>
    /// <item>Tốc độ = 225 × (hero.bonusSpd || 1). Không có hero nào định nghĩa
    ///       bonusSpd, nên thực tế luôn là 225 — con số này đến từ
    ///       <c>PlayerStats.Speed</c>, không hardcode ở đây.</item>
    /// <item>Giữ trong biên sân và giải va chạm THEO TỪNG TRỤC để trượt dọc tường
    ///       thay vì dính.</item>
    /// </list>
    ///
    /// Dùng Rigidbody2D kinematic thay vì dynamic: dynamic có quán tính và cảm
    /// giác trượt, khác hẳn bản web (dừng là dừng ngay).
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("Biên sân (world units)")]
        public Rect Bounds = new Rect(0.6f, 0.6f, 12.8f, 7.2f);

        [Header("Vật cản")]
        public LayerMask ObstacleMask;
        public float Radius = 0.17f;

        /// <summary>Tốc độ (world units/giây). Được gán từ PlayerStats.Speed / 100.</summary>
        public float Speed = 2.25f;

        public Vector2 Facing { get; private set; } = Vector2.down;
        public bool IsMoving { get; private set; }

        private Rigidbody2D _rb;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody2D>();
            _rb.bodyType = RigidbodyType2D.Kinematic;
            _rb.simulated = true;
        }

        /// <summary>Đọc input thành vector ý định; tách khỏi Update để test được.</summary>
        public Vector2 ReadInput()
        {
            var kb = Keyboard.current;
            if (kb == null) return Vector2.zero;

            float mx = 0f, my = 0f;
            if (kb.wKey.isPressed || kb.upArrowKey.isPressed) my += 1f;
            if (kb.sKey.isPressed || kb.downArrowKey.isPressed) my -= 1f;
            if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) mx -= 1f;
            if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) mx += 1f;
            return new Vector2(mx, my);
        }

        /// <summary>
        /// Áp một vector ý định cho một bước thời gian. Public để PlayMode test gọi
        /// trực tiếp mà không cần bàn phím.
        /// </summary>
        public void Step(Vector2 intent, float dt)
        {
            IsMoving = Mathf.Abs(intent.x) > 0.05f || Mathf.Abs(intent.y) > 0.05f;
            if (!IsMoving) return;

            // CHUẨN HOÁ: đi chéo cùng tốc độ với đi thẳng.
            Vector2 dir = intent.normalized;
            Facing = dir;

            Vector2 pos = _rb.position;
            float step = Speed * dt;

            // Giải theo từng trục, đúng như web: trục nào bị chặn thì trục kia vẫn đi.
            float nextX = pos.x + dir.x * step;
            if (!Blocked(new Vector2(nextX, pos.y)))
                pos.x = Mathf.Clamp(nextX, Bounds.xMin, Bounds.xMax);

            float nextY = pos.y + dir.y * step;
            if (!Blocked(new Vector2(pos.x, nextY)))
                pos.y = Mathf.Clamp(nextY, Bounds.yMin, Bounds.yMax);

            _rb.MovePosition(pos);
        }

        private bool Blocked(Vector2 p)
        {
            if (ObstacleMask == 0) return false;
            return Physics2D.OverlapCircle(p, Radius, ObstacleMask) != null;
        }

        private void Update()
        {
            Step(ReadInput(), TimeStep.Delta);
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.2f, 0.7f, 1f, 0.5f);
            Gizmos.DrawWireCube(Bounds.center, Bounds.size);
            Gizmos.DrawWireSphere(transform.position, Radius);
        }
    }
}
