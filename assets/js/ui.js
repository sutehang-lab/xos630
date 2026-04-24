const canvas = document.getElementById('canvas');


// 布局循环按钮：根据分割线(bar)的当前位置，向左或向右“乒乓”循环
const layoutCycleBtn = document.getElementById('layout-cycle-btn');
const _layoutWidths = [1848, 1232, 616, 0];
let _layoutIdx = 0;
let _layoutDir = 1; // 1 为前进，-1 为后退
let _isLayoutBtnClick = false;

layoutCycleBtn.addEventListener('click', () => {
    // 新增：如果设置在前台，先关闭设置
    const settingsOverlayMap = document.getElementById('settings-overlay-map');
    const settingsOverlayScene = document.getElementById('settings-overlay-scene');
    const isSettingsOpen = (settingsOverlayMap && settingsOverlayMap.classList.contains('active')) ||
        (settingsOverlayScene && settingsOverlayScene.classList.contains('active'));

    if (isSettingsOpen) {
        if (window._closeSettingsApp) window._closeSettingsApp();

        // 仅关闭设置应用，直接返回，不再执行本次“乒乓”操作
        return;
    }

    _isLayoutBtnClick = true;
    _layoutIdx += _layoutDir;
    if (_layoutIdx >= _layoutWidths.length - 1) {
        _layoutIdx = _layoutWidths.length - 1;
        _layoutDir = -1; // 触底反弹
    } else if (_layoutIdx <= 0) {
        _layoutIdx = 0;
        _layoutDir = 1;  // 到头反弹
    }
    snapByLeftWidth(_layoutWidths[_layoutIdx]);

    setTimeout(() => {
        _isLayoutBtnClick = false;
    }, 50); // 给一点延迟防止同步事件误判
});

// ── 窗口交换逻辑 ──────────────────────────────
function swapWindows() {
    if (!canvas.classList.contains('state-2')) return; // 仅分屏时有效

    const midWidget = document.getElementById('mid-widget');
    if (midWidget) {
        midWidget.style.opacity = '0';
        setTimeout(() => {
            midWidget.style.opacity = '1';
        }, 600);
    }

    const isSwapped = canvas.classList.contains('swapped');
    const leftEl = isSwapped ? mapWindow : sceneContainer_gesture;
    let currentLeftW = parseFloat(leftEl.style.width);
    if (isNaN(currentLeftW)) currentLeftW = 616;

    canvas.classList.toggle('swapped');
    const newLeftW = 1848 - currentLeftW;
    applySnap(newLeftW);

    const newIsSwapped = !isSwapped;
    let snapState = 'scene-1-3';
    if (newLeftW > 924) {
        snapState = newIsSwapped ? 'scene-1-3' : 'scene-2-3';
    } else {
        snapState = newIsSwapped ? 'scene-2-3' : 'scene-1-3';
    }
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { snap: snapState } }));
}

// ── DEBUG: 音量按钮 → 交换左右窗口 ──────────────────────────────
document.getElementById('volume-debug-btn').addEventListener('click', swapWindows);

// ── 三指滑动互换窗口 ──────────────────────────────
let _threeFingerStartX = 0;
let _isThreeFingerSwiping = false;
let _hasSwappedByTouch = false;

document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 3) {
        _isThreeFingerSwiping = true;
        _hasSwappedByTouch = false;
        let sumX = 0;
        for (let i = 0; i < 3; i++) {
            sumX += e.touches[i].clientX;
        }
        _threeFingerStartX = sumX / 3;
    } else {
        _isThreeFingerSwiping = false;
    }
});

document.addEventListener('touchmove', (e) => {
    if (!_isThreeFingerSwiping || e.touches.length !== 3) return;

    let sumX = 0;
    for (let i = 0; i < 3; i++) {
        sumX += e.touches[i].clientX;
    }
    let currentX = sumX / 3;
    let deltaX = currentX - _threeFingerStartX;

    if (!_hasSwappedByTouch && Math.abs(deltaX) > 80) { // 80px 触发阈值
        _hasSwappedByTouch = true;
        swapWindows();
    }
});

document.addEventListener('touchend', (e) => {
    if (e.touches.length < 3) {
        _isThreeFingerSwiping = false;
    }
});

// 拖拽手势/状态改变时，同步循环按钮的内部索引（但不强行改变来回方向）
window.addEventListener('app-state-change', (e) => {
    if (_isLayoutBtnClick) return; // 避免由于本身点击导致的宽度读取延迟造成的误同步
    if (window.isDrivingMode) return; // 行驶机位下维持参数不变

    // 更新记忆的最后一次分屏状态
    setTimeout(() => {
        const isState2 = canvas.classList.contains('state-2');
        if (isState2) {
            const isSwapped = canvas.classList.contains('swapped');
            const leftEl = isSwapped ? document.querySelector('.map-window') : document.getElementById('three-js-canvas-container');
            const curLeftW = parseFloat(leftEl.style.width) || (leftEl ? leftEl.offsetWidth : 616);
            if (curLeftW > 900) {
                window._lastSplit_leftW = 1232;
            } else if (curLeftW > 300) {
                window._lastSplit_leftW = 616;
            }

            // 动态切换设置应用的宿主容器，确保互换后依然覆盖 2/3 窗口
            const settingsOverlayMap = document.getElementById('settings-overlay-map');
            const settingsOverlayScene = document.getElementById('settings-overlay-scene');
            const isMapActive = settingsOverlayMap && settingsOverlayMap.classList.contains('active');
            const isSceneActive = settingsOverlayScene && settingsOverlayScene.classList.contains('active');

            if (isMapActive || isSceneActive) {
                if (curLeftW > 900) { // 左侧是 2/3
                    if (isSwapped) {
                        if (!isMapActive) { settingsOverlayScene.classList.remove('active'); settingsOverlayMap.classList.add('active'); }
                    } else {
                        if (!isSceneActive) { settingsOverlayMap.classList.remove('active'); settingsOverlayScene.classList.add('active'); }
                    }
                } else { // 右侧是 2/3
                    if (isSwapped) {
                        if (!isSceneActive) { settingsOverlayMap.classList.remove('active'); settingsOverlayScene.classList.add('active'); }
                    } else {
                        if (!isMapActive) { settingsOverlayScene.classList.remove('active'); settingsOverlayMap.classList.add('active'); }
                    }
                }
            }
        }
    }, 50);

    const isSwapped = canvas.classList.contains('swapped');
    const isStateC = canvas.classList.contains('state-c');
    const isState2 = canvas.classList.contains('state-2');
    let currentW = 0;
    if (isStateC) {
        currentW = isSwapped ? 1848 : 0;
    } else if (!isState2) {
        currentW = isSwapped ? 0 : 1848;
    } else {
        const leftEl = isSwapped ? document.querySelector('.map-window') : document.getElementById('three-js-canvas-container');
        currentW = parseFloat(leftEl.style.width) || (leftEl ? leftEl.offsetWidth : 0) || 0;
    }

    let minDiff = Infinity, closest = 0;
    _layoutWidths.forEach((w, i) => {
        if (Math.abs(w - currentW) < minDiff) {
            minDiff = Math.abs(w - currentW);
            closest = i;
        }
    });
    _layoutIdx = closest;
    // 保留原本的 _layoutDir，这样接下来的点击就能接着原本的来回顺序走了
});

// 手势交互（同时支持鼠标和触摸）
// 状态A（全屏车模）↔ 状态B（分屏）↔ 状态C（全屏地图）
// 分屏内五档吸附：状态C | 左1/3 | 默认 | 右1/3 | 状态A


const dividerZone = document.getElementById('divider-touch-zone');
const midWidget = document.getElementById('mid-widget');
const sceneContainer_gesture = document.getElementById('three-js-canvas-container');
const mapWindow = document.querySelector('.map-window');
let _dragMode = null; // null | 'right-edge' | 'left-edge' | 'divider'
let _rightEdgeTimer = null;
let _leftEdgeTimer = null;
let _dividerDownX = 0; // 新增：记录按下分割线的 X 坐标
let _edgeDownX = 0; // 记录边缘按下的坐标

// 吸附位置常量
const SNAP_R_SCENE_W = 1232;
// 吸附阈值（相邻两档中点）
const THRESH_C = 304;   // mid(0, 608) → 状态C
const THRESH_R = 920;   // mid(608, 1232)
const THRESH_A = 1560;  // mid(1232, ~1900) → 状态A

// 辅助：清除所有手势 inline 样式
function clearGestureStyles() {
    sceneContainer_gesture.style.width = '';
    sceneContainer_gesture.style.left = '';
    mapWindow.style.left = '';
    mapWindow.style.width = '';
    dividerZone.style.left = '';
    midWidget.style.left = '';
    midWidget.style.transition = '';
}

// 辅助：进入状态C
function enterStateC() {
    canvas.classList.remove('state-2');
    canvas.classList.add('state-c');
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { snap: 'state-c' } }));
    requestAnimationFrame(clearGestureStyles);
}

// 辅助：进入状态A
function enterStateA() {
    canvas.classList.remove('state-2');
    canvas.classList.remove('state-c');
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { snap: 'state-a' } }));
    requestAnimationFrame(clearGestureStyles);
}

// 辅助：应用某档吸附样式（leftW = 左侧窗口宽度）
function applySnap(leftW) {
    requestAnimationFrame(() => {
        const swapped = canvas.classList.contains('swapped');
        if (leftW == null) {
            clearGestureStyles();
            return;
        }

        if (leftW < -24) leftW = -24;
        if (leftW > 1872) leftW = 1872;

        const rightLeft = leftW + 48;
        const rightW = Math.max(0, 1920 - rightLeft - 24);

        if (dividerZone && midWidget) {
            dividerZone.style.left = (leftW - 4) + 'px';
            midWidget.style.left = (leftW + 34) + 'px';
        }

        if (!swapped) {
            sceneContainer_gesture.style.left = '24px';
            sceneContainer_gesture.style.width = Math.max(0, leftW) + 'px';
            mapWindow.style.left = rightLeft + 'px';
            mapWindow.style.width = rightW + 'px';
        } else {
            mapWindow.style.left = '24px';
            mapWindow.style.width = Math.max(0, leftW) + 'px';
            sceneContainer_gesture.style.left = rightLeft + 'px';
            sceneContainer_gesture.style.width = rightW + 'px';
        }
    });
}

// 辅助：四档吸附判定（基于左侧窗口宽度）
function snapByLeftWidth(leftW) {
    const isSwapped = canvas.classList.contains('swapped');
    if (leftW > 1540) {
        if (isSwapped) enterStateC(); else enterStateA();
    } else if (leftW > 924) {
        canvas.classList.remove('state-c');
        canvas.classList.add('state-2');
        window._lastSplit_leftW = 1232;
        applySnap(1232);
        window.dispatchEvent(new CustomEvent('app-state-change', { detail: { snap: isSwapped ? 'scene-1-3' : 'scene-2-3' } }));
    } else if (leftW > 308) {
        canvas.classList.remove('state-c');
        canvas.classList.add('state-2');
        window._lastSplit_leftW = 616;
        applySnap(616);
        window.dispatchEvent(new CustomEvent('app-state-change', { detail: { snap: isSwapped ? 'scene-2-3' : 'scene-1-3' } }));
    } else {
        if (isSwapped) enterStateA(); else enterStateC();
    }
}

// 1) 边缘拖入侦测
canvas.addEventListener('pointerdown', (e) => {
    if (_dragMode) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const relX = (e.clientX - rect.left) * scaleX;
    const relY = (e.clientY - rect.top) * scaleX;

    if (relY > 980) return; // 排除底部 dock 栏区域，防止误触
    if (relY < 72) return; // 排除顶部 status 栏区域，防止误触

    const isStateA = !canvas.classList.contains('state-2') && !canvas.classList.contains('state-c');
    const isStateC = canvas.classList.contains('state-c');

    if ((isStateA || isStateC) && (relX >= 1840 || relX <= 80)) {
        e.preventDefault();
        _dragMode = relX >= 1840 ? 'right-edge' : 'left-edge';
        _edgeDownX = e.clientX; // 记录边缘按下的坐标

        // 立即隐藏 Good Morning（其它元素保持可见）
        const goodMorning = canvas.querySelector('.good-morning');
        if (goodMorning) goodMorning.style.opacity = '0';

        // 取消所有动画，让元素在 swapped 时能瞬间完成空间转移而不要飞越屏幕
        // 为了防止主窗口缩小产生跳变，保留主窗口的过渡动画；
        // 同时为了防止被召唤的副窗口飞越屏幕，取消副窗口的过渡动画
        const fastTransition = 'all 200ms ease-out';
        if (isStateA) {
            sceneContainer_gesture.style.transition = fastTransition;
            mapWindow.style.transition = 'none';
        } else {
            sceneContainer_gesture.style.transition = 'none';
            mapWindow.style.transition = fastTransition;
        }

        // 取消分割线（bar）的动画，保证它在拖拽时能百分百实时咬合手指的位置，无延迟感
        midWidget.style.transition = 'none';

        const uiInScene = canvas.querySelectorAll('.weather-text, .control-l, .control-r, .nav-item-base, .map-ui-item');
        uiInScene.forEach(el => el.style.transition = fastTransition);

        // 动态决断 swapped
        if (isStateA) {
            if (_dragMode === 'right-edge') canvas.classList.remove('swapped');
            else canvas.classList.add('swapped');
        } else if (isStateC) {
            if (_dragMode === 'right-edge') canvas.classList.add('swapped');
            else canvas.classList.remove('swapped');
        }

        canvas.classList.remove('state-c');
        canvas.classList.add('state-2');

        if (_dragMode === 'right-edge') {
            applySnap(1872); // 产生正确的 24px 右侧间距
        } else {
            applySnap(-24);  // 产生正确的 24px 左侧间距
        }

        // 强制重绘，确保空间转移不留痕迹
        void canvas.offsetWidth;

        const timerFunc = () => {
            if (_dragMode === 'right-edge') _rightEdgeTimer = null;
            else _leftEdgeTimer = null;
            sceneContainer_gesture.style.transition = 'none';
            mapWindow.style.transition = 'none';
            uiInScene.forEach(el => el.style.transition = '');
        };

        if (_dragMode === 'right-edge') {
            _rightEdgeTimer = setTimeout(timerFunc, 200);
        } else {
            _leftEdgeTimer = setTimeout(timerFunc, 200);
        }
    }
});

// 2) 状态B：分割线开始拖拽
let _dragStartLeftW = 0;
dividerZone.addEventListener('pointerdown', (e) => {
    _dragMode = 'divider';
    _dividerDownX = e.clientX; // 记录按下的位置，以区分点击与拖拽
    e.preventDefault();
    sceneContainer_gesture.style.transition = 'none';
    mapWindow.style.transition = 'none';
    midWidget.style.transition = 'none';

    const isSwapped = canvas.classList.contains('swapped');
    const leftEl = isSwapped ? mapWindow : sceneContainer_gesture;
    const curLeftW = parseFloat(leftEl.style.width) || leftEl.offsetWidth;
    _dragStartLeftW = curLeftW;
    applySnap(curLeftW);
});

// 统一 move
document.addEventListener('pointermove', (e) => {
    if (!_dragMode) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const pointerX = (e.clientX - rect.left) * scaleX;

    let leftW = Math.max(-24, Math.min(1872, pointerX - 36));

    const isSettingsOpen = document.getElementById('settings-overlay-map')?.classList.contains('active') ||
        document.getElementById('settings-overlay-scene')?.classList.contains('active');

    if (isSettingsOpen && _dragMode === 'divider') {
        leftW = Math.max(_dragStartLeftW - 100, Math.min(_dragStartLeftW + 100, leftW));
    }

    applySnap(leftW);

    let currentW = parseFloat(sceneContainer_gesture.style.width);
    if (isNaN(currentW)) currentW = sceneContainer_gesture.offsetWidth;
    window.dispatchEvent(new CustomEvent('app-scene-drag', { detail: { width: currentW } }));
});

// 统一 up
document.addEventListener('pointerup', (e) => {
    if (!_dragMode) return;
    const mode = _dragMode;
    _dragMode = null;
    midWidget.style.transition = ''; /* restore CSS transition for snap animation */

    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const pointerX = (e.clientX - rect.left) * scaleX;
    const leftW = Math.max(-24, Math.min(1872, pointerX - 36));

    if (_rightEdgeTimer) { clearTimeout(_rightEdgeTimer); _rightEdgeTimer = null; }
    if (_leftEdgeTimer) { clearTimeout(_leftEdgeTimer); _leftEdgeTimer = null; }

    const uiEls = canvas.querySelectorAll('.weather-text, .good-morning, .control-l, .control-r, .nav-item-base, .map-ui-item');

    // 检查是否为点击 (移动距离极小)
    const downX = (mode === 'divider') ? _dividerDownX : _edgeDownX;
    const isClick = Math.abs(e.clientX - downX) < 10;

    const isSettingsOpen = document.getElementById('settings-overlay-map')?.classList.contains('active') ||
        document.getElementById('settings-overlay-scene')?.classList.contains('active');

    if (isClick) {
        // 点击边缘或bar，窗口化动画修改成200ms
        const fastTransition = 'all 200ms ease-out';
        sceneContainer_gesture.style.transition = fastTransition;
        mapWindow.style.transition = fastTransition;
        midWidget.style.transition = fastTransition;
        uiEls.forEach(el => el.style.transition = fastTransition); // 保证 UI 跟随 200ms 同步回弹
        uiEls.forEach(el => el.style.opacity = '');

        // 强制重绘，避免状态变化时没有动画而产生“跳变”
        void sceneContainer_gesture.offsetWidth;

        if (mode === 'divider') {
            if (isSettingsOpen) {
                snapByLeftWidth(_dragStartLeftW);
            } else {
                // 在左侧1/3和右侧1/3之间切换
                let targetW = (Math.abs(leftW - 616) < Math.abs(leftW - 1232)) ? 1232 : 616;
                snapByLeftWidth(targetW);
            }
        } else if (mode === 'left-edge') {
            snapByLeftWidth(0); // 仅仅点击边缘，退回左边缘全屏
        } else if (mode === 'right-edge') {
            snapByLeftWidth(1848); // 仅仅点击边缘，退回右边缘全屏
        }

        // 200ms 动画结束后，恢复默认的 0.6s 过渡动画，防止全局动画被永远加速
        setTimeout(() => {
            sceneContainer_gesture.style.transition = '';
            mapWindow.style.transition = '';
            midWidget.style.transition = '';
            uiEls.forEach(el => el.style.transition = '');
        }, 250);
    } else {
        sceneContainer_gesture.style.transition = '';
        mapWindow.style.transition = '';
        midWidget.style.transition = '';
        uiEls.forEach(el => {
            el.style.transition = '';
            el.style.opacity = '';
        });

        if (isSettingsOpen && mode === 'divider') {
            snapByLeftWidth(_dragStartLeftW);
        } else {
            // 如果用户从边缘拖动bar时，需要拖动大于 60px 才能进入分屏
            if (mode === 'left-edge' && leftW > 60 && leftW <= 308) {
                snapByLeftWidth(616);
            } else if (mode === 'right-edge' && leftW < 1848 - 60 && leftW >= 1540) {
                snapByLeftWidth(1232);
            } else {
                snapByLeftWidth(leftW); // 非边缘位置拖动逻辑维持现状
            }
        }
    }
});

// 如果你有其他按钮触发状态（如 debugBtn），也请确保加上这一行

// ─── 滑动解锁交互 ─────────────────────────────────────────────────────────
const goHomeWidget = document.getElementById('go-home-widget');
const goHomeFill = document.getElementById('go-home-fill');
const navItemSearch = document.querySelector('.nav-item-search');
const navItemShortcuts = document.querySelector('.nav-item-shortcuts');

let sliderDownX = 0;
let sliderDragging = false;
let sliderCurrentW = 104;
const MAX_SLIDER_W = 358; // 370 - 12
const MIN_SLIDER_W = 104;

if (goHomeFill) {
    goHomeFill.addEventListener('pointerdown', (e) => {
        sliderDragging = true;
        sliderDownX = e.clientX;
        goHomeFill.style.transition = 'none';
        goHomeFill.setPointerCapture(e.pointerId);
        e.stopPropagation();
    });

    goHomeFill.addEventListener('pointermove', (e) => {
        if (!sliderDragging) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = 1920 / rect.width;
        const deltaX = (e.clientX - sliderDownX) * scaleX;
        let newW = MIN_SLIDER_W + deltaX;
        newW = Math.max(MIN_SLIDER_W, Math.min(MAX_SLIDER_W, newW));
        goHomeFill.style.width = newW + 'px';
        sliderCurrentW = newW;

        // 只要长度超过356就触发，不用等待松手
        if (sliderCurrentW >= 356) {
            sliderDragging = false;
            goHomeFill.releasePointerCapture(e.pointerId);
            triggerGoHomeSequence();
        }
    });

    goHomeFill.addEventListener('pointerup', (e) => {
        if (!sliderDragging) return;
        sliderDragging = false;
        goHomeFill.releasePointerCapture(e.pointerId);

        if (sliderCurrentW < 356) {
            // 未达到触发值，松手恢复原状
            goHomeFill.style.transition = 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
            goHomeFill.style.width = MIN_SLIDER_W + 'px';
            sliderCurrentW = MIN_SLIDER_W;
        }
    });
}

function triggerGoHomeSequence() {
    // 此时已经是拉满状态，将其固定为内部拉满 (状态2)
    goHomeWidget.classList.add('activated-inner');

    // 为后续的吞掉边距和发光准备过渡动画，加入 width 保证完全同步
    goHomeFill.style.transition = 'border-radius 0.2s ease-out, left 0.2s ease-out, top 0.2s ease-out, bottom 0.2s ease-out, right 0.2s ease-out, width 0.2s ease-out';

    // 等待 100ms 后，触发填充边距和发光 (状态3和4同步出现)
    setTimeout(() => {
        goHomeWidget.classList.add('activated-full');
        goHomeWidget.classList.add('activated-glow');
    }, 100);

    setTimeout(() => {
        goHomeWidget.classList.add('dismissed');
        if (navItemSearch) navItemSearch.classList.add('shifted-up');
        if (navItemShortcuts) navItemShortcuts.classList.add('shifted-up');

        // 控件消失后，让状态栏产生变化
        const statusLeftBtn = document.getElementById('status-left-btn');
        if (statusLeftBtn) statusLeftBtn.classList.add('active-driving');

        // 等待 300ms 后切换到行驶机位
        setTimeout(() => {
            if (window.transitionToDrivingMode) window.transitionToDrivingMode();
        }, 300);
    }, 900); // 整体展示 800ms 后销毁
}

window.isDrivingMode = false;
window.transitionToDrivingMode = null; // 会在下面的 module 脚本里实现

window.returnToPView = null;

const statusLeftBtn = document.getElementById('status-left-btn');
if (statusLeftBtn) {
    statusLeftBtn.addEventListener('click', () => {
        if (window.returnToPView) {
            window.returnToPView();
        }
    });
}

// 绑定头像点击打开/关闭工作区面板
const debugAvatarBtn = document.getElementById('debug-avatar-btn');
const workspacePanel = document.querySelector('.workspace');
/*
if (debugAvatarBtn && workspacePanel) {
    debugAvatarBtn.addEventListener('click', () => {
        if (workspacePanel.style.display === 'flex') {
            workspacePanel.style.display = 'none';
        } else {
            workspacePanel.style.display = 'flex';
        }
    });
}
*/

// AI Avatar Controller (Expressions + Physical Actions + Random Blinking)

const _wrapper = document.querySelector('.app-wrapper');

function syncScale() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    _wrapper.style.transform = `translate(-50%, -50%) scale(${s})`;
}

syncScale();
window.addEventListener('resize', syncScale);
document.addEventListener('fullscreenchange', () => {
    syncScale();
    setTimeout(syncScale, 100);
    setTimeout(syncScale, 500);
});

// Add orientationchange for iPad
window.addEventListener('orientationchange', () => {
    setTimeout(syncScale, 100);
    setTimeout(syncScale, 500);
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// ─── 设置应用逻辑 ──────────────────────────────
window._closeSettingsApp = null;
let _preSettingsState = null;

const dockSettingsBtn = document.getElementById('dock-settings-btn');
const settingsOverlayMap = document.getElementById('settings-overlay-map');
const settingsCloseBtnMap = document.getElementById('settings-close-btn-map');
const settingsOverlayScene = document.getElementById('settings-overlay-scene');
const settingsCloseBtnScene = document.getElementById('settings-close-btn-scene');

if (dockSettingsBtn && settingsOverlayMap && settingsCloseBtnMap && settingsOverlayScene && settingsCloseBtnScene) {
    window._closeSettingsApp = () => {
        settingsOverlayMap.classList.remove('active');
        settingsOverlayScene.classList.remove('active');

        // 恢复打开前的状态
        if (_preSettingsState) {
            if (_preSettingsState.type === 'state-a') {
                enterStateA();
            } else if (_preSettingsState.type === 'state-c') {
                enterStateC();
            }
            // 如果打开前就是 state-2，保持即可，不用恢复（因为原本就在分屏）
            _preSettingsState = null;
        }
    };

    dockSettingsBtn.addEventListener('click', () => {
        const isMapActive = settingsOverlayMap.classList.contains('active');
        const isSceneActive = settingsOverlayScene.classList.contains('active');

        if (!isMapActive && !isSceneActive) {
            const isStateA = !canvas.classList.contains('state-2') && !canvas.classList.contains('state-c');
            const isStateC = canvas.classList.contains('state-c');
            const isState2 = canvas.classList.contains('state-2');
            const currentSwapped = canvas.classList.contains('swapped');

            // 记录打开前的状态
            if (isStateA) _preSettingsState = { type: 'state-a', isSwapped: currentSwapped };
            else if (isStateC) _preSettingsState = { type: 'state-c', isSwapped: currentSwapped };
            else _preSettingsState = { type: 'state-2' };

            if (!isState2) {
                // 全屏状态下打开设置：
                // 1. 记忆最后一次分屏状态，决定打开在哪边（上一次分屏时2/3的一边）
                // 2. 当前可见桌面还在（被挤到1/3位置）
                const lastLeftW = window._lastSplit_leftW || 616;
                let newSwapped = false;

                if (isStateA) {
                    newSwapped = (lastLeftW === 1232);
                } else if (isStateC) {
                    newSwapped = (lastLeftW === 616);
                }

                // 预定位被隐藏的窗口，防止它从错误的边缘“飞”过来
                const hiddenEl = isStateA ? document.querySelector('.map-window') : document.getElementById('three-js-canvas-container');
                hiddenEl.style.transition = 'none';

                if (lastLeftW === 616) {
                    // 即将出现在右侧 (2/3)，所以让它先藏在屏幕右边缘外
                    hiddenEl.style.left = '1944px';
                } else {
                    // 即将出现在左侧 (2/3)，所以让它先藏在屏幕左边缘外
                    hiddenEl.style.left = '-1264px';
                }
                hiddenEl.style.width = '1232px'; // 提前定好 2/3 的宽度，避免入场时宽度突变
                void hiddenEl.offsetWidth; // 强制重绘，应用初始位置
                hiddenEl.style.transition = ''; // 恢复过渡动画

                if (newSwapped) canvas.classList.add('swapped');
                else canvas.classList.remove('swapped');

                snapByLeftWidth(lastLeftW);

                // 覆盖被拉出来成为 2/3 的那个隐藏窗口
                if (isStateA) {
                    settingsOverlayMap.classList.add('active');
                } else {
                    settingsOverlayScene.classList.add('active');
                }
            } else {
                // 分屏状态下，固定覆盖当前的 2/3 窗口
                const isSwapped = canvas.classList.contains('swapped');
                const leftEl = isSwapped ? document.querySelector('.map-window') : document.getElementById('three-js-canvas-container');
                let currentLeftW = parseFloat(leftEl.style.width);
                if (isNaN(currentLeftW)) currentLeftW = leftEl.offsetWidth || 1232;

                if (currentLeftW > 900) { // 左侧是 2/3 窗口
                    if (isSwapped) {
                        settingsOverlayMap.classList.add('active');
                    } else {
                        settingsOverlayScene.classList.add('active');
                    }
                } else { // 右侧是 2/3 窗口
                    if (isSwapped) {
                        settingsOverlayScene.classList.add('active');
                    } else {
                        settingsOverlayMap.classList.add('active');
                    }
                }
            }
        } else {
            window._closeSettingsApp();
        }
    });

    settingsCloseBtnMap.addEventListener('click', window._closeSettingsApp);
    settingsCloseBtnScene.addEventListener('click', window._closeSettingsApp);
}

// ─── Scene Mode Logic ──────────────────────────────
const sceneModeBtn = document.querySelector('.control-r');
const sceneModeOverlay = document.getElementById('scene-mode-overlay');
const sceneModeCloseBtn = document.getElementById('scene-mode-close-btn');

if (sceneModeBtn && sceneModeOverlay && sceneModeCloseBtn) {
    // Add pointer style to indicate it's clickable
    sceneModeBtn.style.cursor = 'pointer';

    sceneModeBtn.addEventListener('click', () => {
        sceneModeOverlay.classList.add('active');
    });

    sceneModeCloseBtn.addEventListener('click', () => {
        sceneModeOverlay.classList.remove('active');
    });
}

const petModeCard = document.querySelector('.card-pet');
const petModeOverlay = document.getElementById('pet-mode-overlay');
const petModeCloseBtn = document.getElementById('pet-mode-close-btn');

if (petModeCard && petModeOverlay && petModeCloseBtn) {
    petModeCard.addEventListener('click', () => {
        petModeOverlay.classList.add('active');
    });

    petModeCloseBtn.addEventListener('click', () => {
        petModeOverlay.classList.remove('active');
        if (sceneModeOverlay) {
            sceneModeOverlay.classList.remove('active');
        }
    });
}
