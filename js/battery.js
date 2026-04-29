const BatterySystem = {
    level: 100,
    state: 'running',
    isCharging: false,
    lastUpdate: Date.now(),
    timer: null
};

const BATTERY_CONFIG = {
    DISCHARGE_RATE: 30000,
    CHARGE_RATE: 30000,
    MIN_BOOT_LEVEL: 5
};

document.addEventListener('DOMContentLoaded', () => {
    initBattery();
});

function initBattery() {
    // 强制从100%开始，不读取本地存储
    BatterySystem.level = 100;
    BatterySystem.state = 'running';
    BatterySystem.lastUpdate = Date.now();
    
    startBatteryLoop();
    updateBatteryUI();
}

function startBatteryLoop() {
    if (BatterySystem.timer) clearInterval(BatterySystem.timer);
    BatterySystem.timer = setInterval(batteryTick, 1000);
}

function batteryTick() {
    const now = Date.now();
    const delta = now - BatterySystem.lastUpdate;
    
    if (BatterySystem.state === 'running') {
        if (delta >= BATTERY_CONFIG.DISCHARGE_RATE) {
            discharge(1);
            BatterySystem.lastUpdate = now;
        }
    } else if (BatterySystem.state === 'charging') {
        if (delta >= BATTERY_CONFIG.CHARGE_RATE) {
            charge(1);
            BatterySystem.lastUpdate = now;
        }
        updateBigBatteryUI();
    }
    
    saveBatteryState();
}

function discharge(amount) {
    BatterySystem.level -= amount;
    if (BatterySystem.level <= 0) {
        BatterySystem.level = 0;
        triggerShutdown();
    } else if (BatterySystem.level <= 1 && BatterySystem.level > 0) {
        showLowBatteryAlert();
    }
    updateBatteryUI();
}

function charge(amount) {
    BatterySystem.level = Math.min(100, BatterySystem.level + amount);
    updateBigBatteryUI();
}

function triggerShutdown() {
    BatterySystem.state = 'shutdown';
    BatterySystem.isCharging = true;
    
    document.getElementById('homeScreen').style.display = 'none';
    document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
    document.getElementById('shutdownScreen').style.display = 'flex';
    
    setTimeout(() => {
        BatterySystem.state = 'charging';
        updateBigBatteryUI();
    }, 500);
}

function shutdownDevice(isResume) {
    BatterySystem.state = 'charging';
    BatterySystem.isCharging = true;
    document.getElementById('shutdownScreen').style.display = 'flex';
    updateBigBatteryUI();
}

function showLowBatteryAlert() {
    const alert = document.getElementById('lowBatteryAlert');
    alert.style.display = 'flex';
    setTimeout(() => {
        alert.style.display = 'none';
        // 强制关机
        if (BatterySystem.level <= 1) {
            BatterySystem.level = 0;
            triggerShutdown();
        }
    }, 3000);
}

function attemptReboot() {
    const error = document.getElementById('rebootError');
    const btn = document.getElementById('rebootBtn');
    
    if (BatterySystem.level < BATTERY_CONFIG.MIN_BOOT_LEVEL) {
        error.textContent = `电量不足 (${Math.floor(BatterySystem.level)}%)，需要 ${BATTERY_CONFIG.MIN_BOOT_LEVEL}% 以上才能开机`;
        error.style.display = 'block';
        setTimeout(() => error.style.display = 'none', 3000);
        return;
    }
    
    BatterySystem.state = 'running';
    BatterySystem.isCharging = false;
    BatterySystem.lastUpdate = Date.now();
    
    document.getElementById('shutdownScreen').style.display = 'none';
    document.getElementById('homeScreen').style.display = 'flex';
    updateBatteryUI();
}

function updateBatteryUI() {
    const level = Math.floor(BatterySystem.level);

    // 状态栏（主屏 + 各 App 的状态栏，共用同一套 .battery-level 类）
    const statusEl = document.getElementById('batteryStatus');
    const levelEls = document.querySelectorAll('.battery-body .battery-level, .battery-level');

    const safeLevel = Math.max(0, Math.min(100, level));
    const scale = safeLevel / 100;

    levelEls.forEach(el => {
        // 固定宽度，不使用 scaleX（transform 缩放在某些情况下会产生像素级锯齿/覆盖不均）
        el.style.width = '100%';
        el.style.transform = 'none';

        // 用 clip-path 裁剪，保证“实心部分”边缘在全屏/非全屏时一致
        const rightPct = 100 - scale * 100;
        el.style.clipPath = `inset(0 ${rightPct}% 0 0)`;

        el.style.background = level <= 20 ? '#ff3b30' : '#000';
    });

    if (statusEl && level <= 20) {
        statusEl.classList.add('low');
    } else if (statusEl) {
        statusEl.classList.remove('low');
    }

    // 同步所有应用界面的电池电量（如有额外逻辑）
    if (typeof syncAppBatteryLevels === 'function') {
        syncAppBatteryLevels(level);
    }

    // 小组件
    const circle = document.getElementById('batteryCircle');
    const percent = document.getElementById('widgetBattery');
    if (circle && percent) {
        const circumference = 100;
        const offset = circumference - (level / 100) * circumference;
        circle.style.strokeDasharray = `${circumference}, ${circumference}`;
        circle.style.strokeDashoffset = offset;
        circle.style.stroke = level <= 20 ? '#ff3b30' : '#34c759';
        percent.textContent = level + '%';
    }

    // 设置里的显示
    const settingBattery = document.getElementById('settingBattery');
    if (settingBattery) {
        settingBattery.textContent = level + '%';
    }
}

function updateBigBatteryUI() {
    const level = Math.floor(BatterySystem.level);
    const fill = document.getElementById('bigBatteryFill');
    const text = document.getElementById('bigBatteryText');
    const label = document.getElementById('chargingLabel');
    const time = document.getElementById('bootEstimate');
    
    if (fill) fill.style.width = level + '%';
    if (text) text.textContent = level + '%';
    
    if (label) {
        label.textContent = level >= 100 ? '已充满' : '已关机，正在充电...';
    }
    
    if (time) {
        if (level >= BATTERY_CONFIG.MIN_BOOT_LEVEL) {
            time.textContent = '现在可以开机';
        } else {
            const need = BATTERY_CONFIG.MIN_BOOT_LEVEL - level;
            const seconds = need * 30;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            time.textContent = `预计还需 ${mins}分${secs}秒`;
        }
    }
}

function saveBatteryState() {
    localStorage.setItem('iosBattery', JSON.stringify({
        level: BatterySystem.level,
        state: BatterySystem.state,
        lastUpdate: BatterySystem.lastUpdate
    }));
}
