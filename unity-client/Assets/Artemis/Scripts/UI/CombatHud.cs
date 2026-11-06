using Artemis.Runtime.Characters;
using Artemis.Runtime.Dungeons;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Artemis.Runtime.UI
{
    /// <summary>
    /// HUD trong trận: máu, phòng, quái còn, cấp, XP, vàng, và thanh máu trùm.
    ///
    /// Chỉ ĐỌC từ <see cref="PlayerStatsBehaviour"/> và <see cref="RunSession"/>;
    /// không tự giữ bản sao số liệu. Nhờ vậy HUD không thể hiển thị một con số
    /// khác với con số đang được dùng để tính sát thương.
    /// </summary>
    public sealed class CombatHud : MonoBehaviour
    {
        [Header("Tham chiếu")]
        public PlayerStatsBehaviour Player;
        public RunSession Session;
        public RoomController Room;

        [Header("Thanh máu người chơi")]
        public Image HpFill;
        public TMP_Text HpText;
        public Image HpGhost;
        public TMP_Text HpPercent;

        [Header("Thông tin trận")]
        public TMP_Text RoomText;
        public TMP_Text EnemyCountText;
        public TMP_Text LevelText;
        public TMP_Text XpText;
        public Image XpFill;
        public TMP_Text GoldText;

        [Header("Trùm")]
        public GameObject BossPanel;
        public TMP_Text BossName;
        public TMP_Text BossHpText;
        public Image BossHpFill;

        [Header("Màu thanh máu (khớp bản web)")]
        public Color HpNormal = new Color(0.13f, 0.77f, 0.37f);
        public Color HpWarn = new Color(0.98f, 0.75f, 0.14f);
        public Color HpCritical = new Color(0.94f, 0.27f, 0.27f);

        private float _ghostTarget = 1f;
        private float _ghostCurrent = 1f;

        private void OnEnable()
        {
            if (Player != null) Player.HpChanged += OnHpChanged;
        }

        private void OnDisable()
        {
            if (Player != null) Player.HpChanged -= OnHpChanged;
        }

        private void OnHpChanged(double hp, double maxHp)
        {
            float pct = maxHp > 0 ? Mathf.Clamp01((float)(hp / maxHp)) : 0f;
            _ghostTarget = pct;

            if (HpFill != null)
            {
                HpFill.fillAmount = pct;
                HpFill.color = pct <= 0.22f ? HpCritical : (pct <= 0.5f ? HpWarn : HpNormal);
            }
            if (HpText != null)
                HpText.text = Mathf.CeilToInt((float)hp).ToString("N0") + " / " + Mathf.CeilToInt((float)maxHp).ToString("N0");
            if (HpPercent != null)
                HpPercent.text = Mathf.RoundToInt(pct * 100f) + "%";
        }

        private void Update()
        {
            // "Ghost" thanh máu trượt chậm về giá trị thật, giống hiệu ứng bản web.
            if (HpGhost != null)
            {
                _ghostCurrent = Mathf.MoveTowards(_ghostCurrent, _ghostTarget, Time.deltaTime * 1.2f);
                HpGhost.fillAmount = _ghostCurrent;
            }

            if (Session == null) return;

            if (RoomText != null)
                RoomText.text = "Phòng " + Session.Room + " / " + Session.MaxRooms;

            if (EnemyCountText != null)
                EnemyCountText.text = "Quái: " + (Room != null ? Room.Enemies.Count : 0);

            if (LevelText != null)
                LevelText.text = "Cấp " + Session.Level;

            if (XpText != null)
                XpText.text = Mathf.FloorToInt((float)Session.Xp) + " / " + Mathf.RoundToInt((float)Session.XpNext) + " EXP";

            if (XpFill != null)
                XpFill.fillAmount = Session.XpNext > 0 ? Mathf.Clamp01((float)(Session.Xp / Session.XpNext)) : 0f;

            if (GoldText != null)
                GoldText.text = Session.RunGold.ToString("N0");

            UpdateBossPanel();
        }

        private void UpdateBossPanel()
        {
            var boss = Room != null ? Room.Enemies.Find(e => e != null && e.IsBoss) : null;
            bool show = boss != null;

            if (BossPanel != null && BossPanel.activeSelf != show) BossPanel.SetActive(show);
            if (!show) return;

            if (BossName != null) BossName.text = Domain.Spawning.EnemySpawner.BossDisplayName(boss.TypeId);
            if (BossHpText != null)
                BossHpText.text = Mathf.CeilToInt((float)boss.Hp) + " / " + Mathf.CeilToInt((float)boss.MaxHp);
            if (BossHpFill != null)
                BossHpFill.fillAmount = boss.MaxHp > 0 ? Mathf.Clamp01((float)(boss.Hp / boss.MaxHp)) : 0f;
        }
    }
}
