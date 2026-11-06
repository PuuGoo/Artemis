using System.Collections.Generic;
using UnityEngine;

namespace Artemis.Runtime.Combat
{
    /// <summary>
    /// Pool đạn. Không bao giờ Instantiate/Destroy trong vòng lặp chiến đấu —
    /// đây là nguồn giật khung hình lớn nhất ở game bắn đạn nhiều.
    /// </summary>
    public sealed class ProjectilePool : MonoBehaviour
    {
        [Header("Cấu hình")]
        public GameObject Prefab;
        public int PrewarmCount = 64;
        public int MaxSize = 512;

        private readonly List<Projectile> _all = new List<Projectile>();
        private readonly Stack<Projectile> _free = new Stack<Projectile>();

        public int ActiveCount { get; private set; }
        public int TotalCreated => _all.Count;

        private void Awake()
        {
            if (Prefab == null) { Debug.LogError("[ProjectilePool] Thiếu Prefab."); return; }
            for (int i = 0; i < PrewarmCount; i++) Create();
        }

        private Projectile Create()
        {
            var go = Instantiate(Prefab, transform);
            go.SetActive(false);
            var p = go.GetComponent<Projectile>();
            if (p == null) p = go.AddComponent<Projectile>();
            p.Pool = this;
            _all.Add(p);
            _free.Push(p);
            return p;
        }

        public Projectile Get(Vector2 position, Vector2 direction, double damage, float speed, bool isEnemy)
        {
            if (_free.Count == 0 && _all.Count < MaxSize) Create();
            if (_free.Count == 0) return null;   // hết pool: bỏ đạn, không cấp phát thêm

            var p = _free.Pop();
            p.gameObject.SetActive(true);
            p.Launch(position, direction, damage, speed, isEnemy);
            ActiveCount++;
            return p;
        }

        public void Return(Projectile p)
        {
            if (p == null || !p.gameObject.activeSelf) return;
            p.gameObject.SetActive(false);
            _free.Push(p);
            ActiveCount = Mathf.Max(0, ActiveCount - 1);
        }

        public void ReturnAll()
        {
            foreach (var p in _all)
                if (p.gameObject.activeSelf) Return(p);
        }
    }
}
