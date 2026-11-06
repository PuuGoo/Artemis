using System;
using System.Collections.Generic;
using UnityEngine;

namespace Artemis.Runtime.Combat
{
    /// <summary>
    /// Một viên đạn. Bay theo hướng cố định (homing để dành cho phase sau), và
    /// tự trả về pool khi hết đời hoặc va chạm.
    ///
    /// Ghi chú "pierce": bản web chống trúng lại cùng một quái bằng
    /// <c>hitSet</c> (Set các tham chiếu quái). Ở đây dùng
    /// <see cref="HashSet{T}"/> trên instance id để giữ đúng hành vi — KHÔNG dựa
    /// vào việc tắt collider, vì như vậy đạn xuyên sẽ bỏ qua quái thứ hai.
    /// </summary>
    public sealed class Projectile : MonoBehaviour
    {
        [Header("Cấu hình")]
        public float Radius = 0.065f;
        public float Lifetime = 3.0f;

        public ProjectilePool Pool;
        public double Damage { get; private set; }
        public bool IsEnemy { get; private set; }
        public bool Pierce { get; set; }
        public int RicochetsLeft { get; set; }
        public bool Active => gameObject.activeSelf;

        private Vector2 _velocity;
        private float _age;
        private readonly HashSet<int> _hitSet = new HashSet<int>();

        /// <summary>Sự kiện khi trúng: (đối tượng trúng, sát thương, xuyên tiếp?).</summary>
        public event Action<Projectile, Collider2D, double> Hit;

        public void Launch(Vector2 position, Vector2 direction, double damage, float speed, bool isEnemy)
        {
            transform.position = position;
            _velocity = direction.normalized * speed;
            Damage = damage;
            IsEnemy = isEnemy;
            _age = 0f;
            _hitSet.Clear();

            if (direction.sqrMagnitude > 0.0001f)
            {
                float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;
                transform.rotation = Quaternion.Euler(0f, 0f, angle);
            }
        }

        private void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);

            transform.position += (Vector3)(_velocity * dt);
            _age += dt;

            if (_age >= Lifetime) Return();

            // Ra khỏi sân thì thu hồi (giữ sân 12.8 x 7.2 như bản web).
            var p = transform.position;
            if (p.x < -1f || p.x > 13.8f || p.y < -1f || p.y > 8.2f) Return();
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            if (other == null) return;

            // Mỗi quái chỉ trúng một lần cho mỗi viên đạn.
            int id = other.GetInstanceID();
            if (!_hitSet.Add(id)) return;

            Hit?.Invoke(this, other, Damage);

            if (!Pierce) Return();
        }

        public void Return()
        {
            _hitSet.Clear();
            if (Pool != null) Pool.Return(this);
            else gameObject.SetActive(false);
        }

        public void ClearHitSet() => _hitSet.Clear();
    }
}
