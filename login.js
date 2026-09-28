(function(){
  function $(sel){return document.querySelector(sel)}

  document.addEventListener('DOMContentLoaded', () => {
    const phoneEl = $('#phone');
    const passwordEl = $('#password');
    const signupBtn = $('#signup-btn');
    const loginBtnModal = $('#login-btn-modal');

    console.log('Login page elements:', {phoneEl, passwordEl, signupBtn, loginBtnModal});

    signupBtn.addEventListener('click', async () => {
      console.log('Signup clicked');
      const phone = phoneEl.value;
      const password = passwordEl.value;
      console.log('Phone:', phone, 'Password:', password);
      try {
        const res = await fetch('/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        console.log('Signup response:', res.status, res.ok);
        const text = await res.text();
        console.log('Signup response text:', text);
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: 'Invalid response' };
        }
        console.log('Signup data:', data);
        if (res.ok) {
          alert('Signed up successfully! Please log in.');
        } else {
          alert(data.error);
        }
      } catch (error) {
        console.error('Signup error:', error);
        alert('Network error: ' + error.message);
      }
    });

    loginBtnModal.addEventListener('click', async () => {
      console.log('Login clicked');
      const phone = phoneEl.value;
      const password = passwordEl.value;
      console.log('Phone:', phone, 'Password:', password);
      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        console.log('Login response:', res.status, res.ok);
        const text = await res.text();
        console.log('Login response text:', text);
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: 'Invalid response' };
        }
        console.log('Login data:', data);
        if (res.ok) {
          localStorage.setItem('token', data.token);
          window.location.href = 'journal.html';
        } else {
          alert(data.error);
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('Network error: ' + error.message);
      }
    });
  });
})();