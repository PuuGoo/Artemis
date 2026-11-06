using System;
using System.Collections.Generic;
using Artemis.Domain.Combat;
using Artemis.Domain.Core;
using UnityEngine;

namespace Artemis.Runtime.Enemies
{
    /// <summary>
    /// Quái trong trận. Chỉ số (HP/ATK/tốc độ/bán kính) do
    /// <c>EnemySpawner</c> của domain quyết định — lớp này KHÔNG tự tính lại,
    /// nếu không thì test parity của spawner sẽ xanh trong khi game vẫn sai.
    /// </summary>
    public sealed class EnemyController : MonoBehaviour
    {
        [Header("Chỉ số (gán từ EnemySpawner)")]
        public string TypeId = "slime";
        public bool IsBoss;
        public double MaxHp = 100;
        public double Hp = 100;
        public double Atk = 10;
        public float Speed = 0.64f;
        public float Radius = 0.16f;

        [Header("Tham chiếu")]
        public Transform Target;
        public float AttackInterval = 1.4f;

        public EnemyState State = new EnemyState();

        public event Action<EnemyController> Died;
        public event Action<EnemyController, double> Attacked;

        private float _attackTimer;

        /// <summary>Bản domain để tính sát thương — dùng chung cho mọi quái.</summary>
        public EnemyState ToState()
        {
            State.Hp = Hp;
            State.MaxHp = MaxHp;
            State.IsBoss = IsBoss;
            State.Type = TypeId;
            State.Atk = Atk;
            return State;
        }

        public void Configure(Domain.Spawning.SpawnSpec spec)
        {
            TypeId = spec.Type;
            IsBoss = spec.IsBoss;
            MaxHp = spec.MaxHp;
            Hp = spec.Hp;
            Atk = spec.Atk;
            // Tốc độ trong công thức là px/giây của bản web (sân 1280x720).
            // Đổi sang world units: chia 100 để giữ tỉ lệ cảm giác di chuyển.
            Speed = (float)(spec.Speed / 100.0);
            Radius = (float)(spec.Radius / 100.0);

            _attackTimer = AttackInterval;
            ToState();
        }

        /// <summary>Chịu sát thương từ đòn của người chơi (domain đã tính finalDmg).</summary>
        public void ApplyDamage(double finalDamage, List<string> events = null)
        {
            if (Hp <= 0) return;
            Hp -= finalDamage;
            if (Hp <= 0)
            {
                Hp = 0;
                Died?.Invoke(this);
            }
        }

        private void Update()
        {
            if (Hp <= 0) return;
            if (Target == null) return;

            float dt = Mathf.Min(Time.deltaTime, 0.05f);

            // plant_turret đứng yên (speed 0 trong bảng gốc).
            if (Speed > 0f)
            {
                Vector2 to = (Vector2)Target.position - (Vector2)transform.position;
                if (to.sqrMagnitude > 0.0001f)
                    transform.position += (Vector3)(to.normalized * Speed * dt);
            }

            _attackTimer -= dt;
            if (_attackTimer <= 0f)
            {
                _attackTimer = AttackInterval;
                Attacked?.Invoke(this, Atk);
            }
        }
    }
}
