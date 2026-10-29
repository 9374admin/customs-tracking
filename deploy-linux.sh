#!/bin/bash
echo "===== Step 1: Install Node.js 24 ====="
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
yum install -y nodejs
node -v
npm -v
echo "Node.js installed."

echo "===== Step 2: Download code from GitHub ====="
rm -rf /opt/customs-tracking
cd /opt
curl -fsSL https://github.com/9374admin/customs-tracking/archive/refs/heads/main.zip -o customs.zip
yum install -y unzip
unzip -o customs.zip
mv customs-tracking-main customs-tracking
rm customs.zip
echo "Code extracted to /opt/customs-tracking"

echo "===== Step 3: Install backend dependencies ====="
cd /opt/customs-tracking/backend
npm install
echo "Backend dependencies installed."

echo "===== Step 4: Verify frontend dist ====="
if [ ! -f /opt/customs-tracking/frontend/dist/index.html ]; then
    echo "Frontend dist missing - downloading..."
    curl -fsSL https://github.com/9374admin/customs-tracking/archive/refs/heads/main.zip -o /tmp/customs2.zip
    unzip -o /tmp/customs2.zip -d /tmp/customs-temp2
    cp -r /tmp/customs-temp2/customs-tracking-main/frontend/dist /opt/customs-tracking/frontend/dist
    rm -rf /tmp/customs-temp2 /tmp/customs2.zip
    echo "Frontend dist downloaded."
fi

echo "===== Step 5: Open firewall port 3000 ====="
firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
echo "Firewall opened."

echo "===== Step 6: Create startup script ====="
cat > /opt/customs-tracking/start.sh << 'EOF'
#!/bin/bash
cd /opt/customs-tracking/backend
export NODE_ENV=production
node --experimental-sqlite src/index.js
EOF
chmod +x /opt/customs-tracking/start.sh
echo "Startup script created."

echo "===== Step 7: Create systemd service ====="
cat > /etc/systemd/system/customs.service << 'EOF'
[Unit]
Description=Customs Tracking Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/customs-tracking/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --experimental-sqlite src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable customs
systemctl start customs
sleep 3
systemctl status customs --no-pager
journalctl -u customs --no-pager -n 20

echo "===== DEPLOY COMPLETE ====="
echo "Access: http://182.160.17.230:3000"
echo "Login: admin / admin123"