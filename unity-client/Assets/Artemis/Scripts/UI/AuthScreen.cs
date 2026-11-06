using System;
using System.Collections;
using Artemis.Domain.Core;
using Artemis.Runtime.Networking;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Artemis.Runtime.UI
{
    /// <summary>
    /// Cổng đăng nhập / đăng ký.
    ///
    /// Dùng CÙNG endpoint và CÙNG ngưỡng kiểm tra với bản web (public/cloud.js):
    /// tên ≥ 3 ký tự, mật khẩu ≥ 8. Không có đường tắt "đăng nhập ẩn danh" —
    /// mọi dữ liệu người chơi phải thuộc về một tài khoản thật.
    ///
    /// Thông báo lỗi hiển thị NGUYÊN VĂN lỗi từ server để không lộ thêm thông tin
    /// (server cố tình trả cùng một câu cho "sai tên" và "sai mật khẩu").
    /// </summary>
    public sealed class AuthScreen : MonoBehaviour
    {
        [Header("Root")]
        public GameObject Panel;

        [Header("Nhập liệu")]
        public TMP_InputField UsernameField;
        public TMP_InputField PasswordField;

        [Header("Nút")]
        public Button LoginButton;
        public Button RegisterButton;
        public Button SwitchModeButton;
        public TMP_Text SwitchModeLabel;
        public TMP_Text SubmitLabel;

        [Header("Trạng thái")]
        public TMP_Text ErrorText;
        public GameObject BusyIndicator;

        private ArtemisApiClient _api;
        private Action _onAuthenticated;
        private bool _registerMode;
        private bool _busy;

        private void Awake()
        {
            if (Panel != null) Panel.SetActive(false);
            if (ErrorText != null) ErrorText.text = string.Empty;
            if (BusyIndicator != null) BusyIndicator.SetActive(false);

            if (LoginButton != null) LoginButton.onClick.AddListener(() => Submit(false));
            if (RegisterButton != null) RegisterButton.onClick.AddListener(() => Submit(true));
            if (SwitchModeButton != null) SwitchModeButton.onClick.AddListener(ToggleMode);
        }

        public void Show(ArtemisApiClient api, Action onAuthenticated)
        {
            _api = api;
            _onAuthenticated = onAuthenticated;
            if (Panel != null) Panel.SetActive(true);
            if (ErrorText != null) ErrorText.text = string.Empty;
            _registerMode = false;
            RefreshModeLabels();
        }

        public void Hide()
        {
            if (Panel != null) Panel.SetActive(false);
            if (PasswordField != null) PasswordField.text = string.Empty;
        }

        private void ToggleMode()
        {
            _registerMode = !_registerMode;
            if (ErrorText != null) ErrorText.text = string.Empty;
            RefreshModeLabels();
        }

        private void RefreshModeLabels()
        {
            if (SubmitLabel != null) SubmitLabel.text = _registerMode ? "✨ Tạo Tài Khoản" : "🔓 Đăng Nhập";
            if (SwitchModeLabel != null)
                SwitchModeLabel.text = _registerMode ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
        }

        private void Submit(bool register)
        {
            if (_busy || _api == null) return;

            string user = UsernameField != null ? UsernameField.text.Trim() : string.Empty;
            string pass = PasswordField != null ? PasswordField.text : string.Empty;
            SetBusy(true);
            if (ErrorText != null) ErrorText.text = string.Empty;

            Action<ApiResponse> done = resp => StartCoroutine(HandleResponse(resp));
            StartCoroutine(register ? _api.Register(user, pass, done) : _api.Login(user, pass, done));
        }

        private IEnumerator HandleResponse(ApiResponse resp)
        {
            yield return null;

            if (resp.IsNetworkFailure)
            {
                ShowError("Lỗi mạng. Kiểm tra kết nối và thử lại.");
                SetBusy(false);
                yield break;
            }

            bool ok = resp.HasBody && resp.Body["ok"].AsBool(false);
            if (!ok)
            {
                string msg = resp.HasBody ? resp.Body["error"].AsString(null) : null;
                ShowError(msg ?? "Không kết nối được máy chủ. Thử lại.");
                SetBusy(false);
                yield break;
            }

            SetBusy(false);
            Hide();
            _onAuthenticated?.Invoke();
        }

        private void ShowError(string message)
        {
            if (ErrorText != null) ErrorText.text = message;
            Debug.LogWarning("[Auth] " + message);
        }

        private void SetBusy(bool busy)
        {
            _busy = busy;
            if (BusyIndicator != null) BusyIndicator.SetActive(busy);
            if (LoginButton != null) LoginButton.interactable = !busy;
            if (RegisterButton != null) RegisterButton.interactable = !busy;
        }
    }
}
