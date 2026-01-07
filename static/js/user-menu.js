/**
 * YFEvents User Menu Widget
 * Floating login/logout navigation that works on any page
 * Fetches auth status from /api/auth/status
 */
(function() {
    // Inject styles
    const styles = `
        #yf-user-menu {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #yf-user-menu .yf-menu-btn {
            background: #2c3e50;
            color: #fff;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #yf-user-menu .yf-menu-btn:hover {
            background: #34495e;
            transform: scale(1.05);
        }
        #yf-user-menu .yf-menu-dropdown {
            display: none;
            position: absolute;
            bottom: 55px;
            right: 0;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.2);
            min-width: 200px;
            overflow: hidden;
        }
        #yf-user-menu .yf-menu-dropdown.show {
            display: block;
        }
        #yf-user-menu .yf-menu-dropdown a {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            color: #333;
            text-decoration: none;
            border-bottom: 1px solid #eee;
            transition: background 0.2s;
        }
        #yf-user-menu .yf-menu-dropdown a:last-child {
            border-bottom: none;
        }
        #yf-user-menu .yf-menu-dropdown a:hover {
            background: #f5f5f5;
        }
        #yf-user-menu .yf-menu-dropdown a svg {
            width: 16px;
            height: 16px;
            color: #666;
        }
        #yf-user-menu .yf-user-info {
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
            font-size: 12px;
            color: #666;
        }
        #yf-user-menu .yf-user-info strong {
            display: block;
            color: #333;
            font-size: 14px;
            word-break: break-all;
        }
        #yf-user-menu .yf-section-label {
            padding: 8px 16px 4px;
            font-size: 10px;
            text-transform: uppercase;
            color: #999;
            letter-spacing: 0.5px;
        }
        #yf-user-menu .yf-login-btn {
            background: #3498db !important;
            color: white !important;
        }
        #yf-user-menu .yf-login-btn:hover {
            background: #2980b9 !important;
        }
    `;

    // SVG icons
    const icons = {
        user: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
        login: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>',
        logout: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>',
        cog: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
        store: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>',
        chat: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>',
        menu: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>'
    };

    // Create menu HTML based on auth status
    function createMenu(authData) {
        const isLoggedIn = authData.authenticated;
        const isAdmin = authData.is_admin;
        const isShopOwner = authData.is_shop_owner;
        const email = authData.email || 'User';

        let dropdownContent = '';

        if (isLoggedIn) {
            dropdownContent = `
                <div class="yf-user-info">
                    <strong>${escapeHtml(email)}</strong>
                    ${isAdmin ? 'Admin' : isShopOwner ? 'Shop Owner' : ''}
                </div>
            `;

            if (isAdmin) {
                dropdownContent += `
                    <div class="yf-section-label">Admin</div>
                    <a href="/admin/">${icons.cog} Admin Dashboard</a>
                    <a href="/admin/calendar/">${icons.calendar} Calendar Admin</a>
                `;
            }

            if (isShopOwner) {
                dropdownContent += `
                    <div class="yf-section-label">Shop Owner</div>
                    <a href="/shop-portal/">${icons.store} Shop Portal</a>
                `;
            }

            if (isAdmin || isShopOwner) {
                dropdownContent += `<a href="/forum/">${icons.chat} Forum</a>`;
            }

            dropdownContent += `
                <div class="yf-section-label">Account</div>
                <a href="/auth/logout.php">${icons.logout} Logout</a>
            `;
        } else {
            dropdownContent = `
                <a href="/auth/login.php" class="yf-login-btn">${icons.login} Sign in with Google</a>
            `;
        }

        const buttonContent = isLoggedIn
            ? `${icons.user} Menu`
            : `${icons.login} Login`;

        return `
            <div class="yf-menu-dropdown" id="yf-dropdown">
                ${dropdownContent}
            </div>
            <button class="yf-menu-btn" id="yf-menu-toggle">
                ${buttonContent}
            </button>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize menu
    async function init() {
        // Add styles
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);

        // Create container
        const container = document.createElement('div');
        container.id = 'yf-user-menu';

        // Fetch auth status
        try {
            const response = await fetch('/api/auth/status.php', { credentials: 'include' });
            const authData = await response.json();
            container.innerHTML = createMenu(authData);
        } catch (e) {
            // If API fails, show login button
            container.innerHTML = createMenu({ authenticated: false });
        }

        document.body.appendChild(container);

        // Add click handler
        document.getElementById('yf-menu-toggle').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('yf-dropdown').classList.toggle('show');
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('yf-dropdown');
            if (dropdown && !container.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
