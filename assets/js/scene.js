import * as THREE from "three";
        import { OrbitControls } from "three/addons/controls/OrbitControls.js";
        import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
        import { gsap } from "gsap";
        import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
        import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
        import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
        import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
        import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
        import { GammaCorrectionShader } from "three/addons/shaders/GammaCorrectionShader.js";

        // ─── 1. Scene ─────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        const bgColor = '#0a0a12';
        scene.background = new THREE.Color(bgColor);
        scene.fog = new THREE.Fog(bgColor, 20, 80);

        // ─── 2. Renderer（复用现有 canvas）────────────────────────────────────────
        const sceneContainer = document.getElementById('three-js-canvas-container');
        const threeCanvas = document.getElementById('three-canvas');

        const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 限制最大像素比，防止性能过载
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.VSMShadowMap;

        // ─── 3. Camera & Controls ─────────────────────────────────────────────────
        function focalToFov(mm) {
            return 2 * Math.atan(24 / (2 * mm)) * (180 / Math.PI);
        }
        const camera = new THREE.PerspectiveCamera(
            focalToFov(parseFloat(document.getElementById('ctrl-focal').value)),
            1920 / 1080, 0.1, 1000
        );
        camera.position.set(9.14, 0.80, -6.64); // Distance=11.3, Elevation=1.5°, Azimuth=126°

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.target.set(0, 0.5, 0);

        function updateCameraLimits() {
            if (window.isDrivingMode) {
                controls.minPolarAngle = (90 - 67) * Math.PI / 180;
                controls.maxPolarAngle = (90 + 0.8) * Math.PI / 180;
            } else {
                controls.minPolarAngle = (90 - 24) * Math.PI / 180;
                controls.maxPolarAngle = (90 + 1.6) * Math.PI / 180;
            }
        }
        updateCameraLimits();


        // 摇臂相机：球坐标辅助函数
        function applyCraneCamera(dist, elevDeg, azDeg) {
            const elev = elevDeg * Math.PI / 180;
            const az = azDeg * Math.PI / 180;
            const rh = dist * Math.cos(elev);
            camera.position.set(
                controls.target.x + rh * Math.sin(az),
                controls.target.y + dist * Math.sin(elev),
                controls.target.z + rh * Math.cos(az)
            );
            controls.update();
            groundUniforms.cameraPos.value.copy(camera.position);
        }
        function readCraneSliders() {
            return {
                dist: parseFloat(document.getElementById('ctrl-distance').value),
                elev: parseFloat(document.getElementById('ctrl-elevation').value),
                az: parseFloat(document.getElementById('ctrl-azimuth').value),
            };
        }

        // 滑块绑定 → 摇臂相机
        document.getElementById('ctrl-distance').addEventListener('input', e => {
            document.getElementById('val-distance').innerText = parseFloat(e.target.value).toFixed(1);
            const s = readCraneSliders(); applyCraneCamera(s.dist, s.elev, s.az);
        });
        document.getElementById('ctrl-elevation').addEventListener('input', e => {
            document.getElementById('val-elevation').innerText = parseFloat(e.target.value).toFixed(1) + '°';
            const s = readCraneSliders(); applyCraneCamera(s.dist, s.elev, s.az);
        });
        document.getElementById('ctrl-azimuth').addEventListener('input', e => {
            document.getElementById('val-azimuth').innerText = parseFloat(e.target.value) + '°';
            const s = readCraneSliders(); applyCraneCamera(s.dist, s.elev, s.az);
        });
        document.getElementById('ctrl-focal').addEventListener('input', e => {
            const mm = parseFloat(e.target.value);
            document.getElementById('val-focal').innerText = mm + 'mm';
            camera.fov = focalToFov(mm);
            camera.updateProjectionMatrix();
        });

        // 画面偏移 (View Shift)
        let _camShiftX = 0;
        let _camShiftY = 0;
        window.updateCameraShift = function () {
            if (_camShiftX === 0 && _camShiftY === 0) {
                camera.clearViewOffset();
            } else {
                const w = sceneContainer.offsetWidth || 1920;
                const h = sceneContainer.offsetHeight || 1080;
                // setViewOffset( fullWidth, fullHeight, x, y, width, height )
                camera.setViewOffset(w, h, _camShiftX, _camShiftY, w, h);
            }
            camera.updateProjectionMatrix();
        };
        document.getElementById('ctrl-shift-x').addEventListener('input', e => {
            _camShiftX = parseFloat(e.target.value);
            document.getElementById('val-shift-x').innerText = _camShiftX;
            window.updateCameraShift();
        });
        document.getElementById('ctrl-shift-y').addEventListener('input', e => {
            _camShiftY = parseFloat(e.target.value);
            document.getElementById('val-shift-y').innerText = _camShiftY;
            window.updateCameraShift();
        });

        // OrbitControls 拖拽 → 同步滑块
        controls.addEventListener('change', () => {
            const rel = camera.position.clone().sub(controls.target);
            const dist = rel.length();
            const elev = Math.asin(Math.max(-1, Math.min(1, rel.y / dist))) * 180 / Math.PI;
            const az = Math.atan2(rel.x, rel.z) * 180 / Math.PI;
            document.getElementById('ctrl-distance').value = dist.toFixed(1);
            document.getElementById('val-distance').innerText = dist.toFixed(1);
            document.getElementById('ctrl-elevation').value = elev.toFixed(1);
            document.getElementById('val-elevation').innerText = elev.toFixed(1) + '°';
            document.getElementById('ctrl-azimuth').value = az.toFixed(0);
            document.getElementById('val-azimuth').innerText = az.toFixed(0) + '°';
        });

        // 边缘区域保留给手势交互，不响应旋转
        threeCanvas.addEventListener('pointerdown', (e) => {
            const rect = threeCanvas.getBoundingClientRect();
            const scale = rect.width / (threeCanvas.clientWidth || 1);
            const inset = 120 * scale;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x < inset || x > rect.width - inset || y < inset || y > rect.height - inset) {
                controls.enabled = false;
                const reEnable = () => {
                    controls.enabled = true;
                    window.removeEventListener('pointerup', reEnable);
                };
                window.addEventListener('pointerup', reEnable);
            }
        }, true);

        // ─── 4. Loading Manager ──────────────────────────────────────────────────
        const loadingScreen = document.getElementById('loading-screen');
        const loadingFill = document.getElementById('loading-fill');
        const loadingText = document.getElementById('loading-text');
        const loadingManager = new THREE.LoadingManager();

        loadingManager.onProgress = (url, loaded, total) => {
            const pct = (loaded / total) * 100;
            loadingFill.style.width = pct + '%';
            loadingText.innerText = Math.floor(pct) + '% / ASSETS LOADING';
        };
        loadingManager.onLoad = () => {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.style.display = 'none', 800);
                // 触发进场动画
                if (window.startEntrySequence) window.startEntrySequence();
            }, 500);
        };
        loadingManager.onError = (url) => {
            console.warn('Asset failed to load:', url);
            loadingFill.style.width = '100%';
            loadingText.innerText = 'ERROR / ASSETS LOADING';
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.style.display = 'none', 800);
            }, 500);
        };
        window.addEventListener('error', (e) => {
            const txt = document.getElementById('loading-text');
            if (txt) txt.innerText = 'SCRIPT ERROR: ' + e.message;
            setTimeout(() => {
                const sc = document.getElementById('loading-screen');
                if (sc) { sc.style.opacity = '0'; setTimeout(() => sc.style.display = 'none', 800); }
            }, 2000);
        });

        // ─── 5. 选择性 Bloom 后期处理 ────────────────────────────────────────────
        const BLOOM_LAYER = 1;
        const bloomLayer = new THREE.Layers();
        bloomLayer.set(BLOOM_LAYER);

        const _initW = sceneContainer.offsetWidth || 1920;
        const _initH = sceneContainer.offsetHeight || 1080;
        renderer.setSize(_initW, _initH, true);
        const dpr = Math.min(window.devicePixelRatio, 2);

        const bloomComposer = new EffectComposer(renderer);
        bloomComposer.setPixelRatio(dpr);
        bloomComposer.renderToScreen = false;
        bloomComposer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(_initW, _initH),
            0.2,  // strength
            0.5,  // radius
            0.6   // threshold
        );
        bloomComposer.addPass(bloomPass);

        const finalPass = new ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: bloomComposer.renderTarget2.texture }
                },
                vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
                fragmentShader: `
                uniform sampler2D baseTexture;
                uniform sampler2D bloomTexture;
                varying vec2 vUv;
                void main() {
                    gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
                }
            `,
            }),
            'baseTexture'
        );
        finalPass.needsSwap = true;

        const finalRenderTarget = new THREE.WebGLRenderTarget(_initW, _initH, {
            samples: 4 // Upgraded to 4x MSAA Anti-Aliasing for balanced quality and performance
        });
        const finalComposer = new EffectComposer(renderer, finalRenderTarget);
        finalComposer.setPixelRatio(dpr);
        finalComposer.addPass(new RenderPass(scene, camera));
        finalComposer.addPass(finalPass);
        finalComposer.addPass(new ShaderPass(GammaCorrectionShader));

        const darkMaterial = new THREE.MeshBasicMaterial({ color: '#000000' });
        const _storedMats = {};
        function darkenNonBloomed(obj) {
            if (obj.isMesh && !bloomLayer.test(obj.layers)) {
                _storedMats[obj.uuid] = obj.material;
                obj.material = darkMaterial;
            }
        }
        function restoreMaterial(obj) {
            if (_storedMats[obj.uuid]) {
                obj.material = _storedMats[obj.uuid];
                delete _storedMats[obj.uuid];
            }
        }

        // ─── 6. 灯光系统 ─────────────────────────────────────────────────────────
        const ambientLight = new THREE.AmbientLight('#223344', 0.16);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight('#334466', '#111111', 0.15);
        scene.add(hemiLight);

        const mainLight = new THREE.DirectionalLight('#88aacc', 1.0);
        mainLight.position.set(15, 15, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(1024, 1024);
        mainLight.shadow.camera.left = -8;
        mainLight.shadow.camera.right = 8;
        mainLight.shadow.camera.top = 5;
        mainLight.shadow.camera.bottom = -5;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 25;
        mainLight.shadow.bias = -0.0005;
        mainLight.shadow.radius = 8;
        scene.add(mainLight);

        const wheelLight = new THREE.DirectionalLight('#4466aa', 0.4);
        wheelLight.position.set(-5, 2, -5);
        scene.add(wheelLight);

        const dirLight = new THREE.DirectionalLight('#6688bb', 0.8);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);


        // ─── 新增：天空与地面自定义着色器 ──────────────────────────────────────
        const skyUniforms = {
            topColor: { value: new THREE.Color('#aaccff') },
            bottomColor: { value: new THREE.Color('#e8ecf0') },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        const skyGeo = new THREE.SphereGeometry(500, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: skyUniforms,
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize( vWorldPosition + vec3( 0.0, offset, 0.0 ) ).y;
                    gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });
        const skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skyMesh);

        const groundUniforms = {
            nearColor: { value: new THREE.Color('#99aabb') },
            farColor: { value: new THREE.Color('#e8ecf0') },
            cameraPos: { value: new THREE.Vector3() },
            groundDepth: { value: 50.0 },
            horizonBlur: { value: 0.5 },
            farFadeStart: { value: 200.0 }, // fade to transparent
            farFadeEnd: { value: 400.0 }
        };
        const groundGeo = new THREE.PlaneGeometry(1000, 1000, 1, 1);
        const groundMat = new THREE.ShaderMaterial({
            uniforms: groundUniforms,
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 nearColor;
                uniform vec3 farColor;
                uniform vec3 cameraPos;
                uniform float groundDepth;
                uniform float horizonBlur;
                uniform float farFadeStart;
                uniform float farFadeEnd;
                varying vec3 vWorldPosition;
                void main() {
                    float dist = distance(vWorldPosition.xz, cameraPos.xz);
                    
                    // Interpolate between near and far color
                    // horizonBlur controls the transition smoothness
                    float mixFactor = smoothstep( groundDepth * (1.0 - horizonBlur), groundDepth * (1.0 + horizonBlur), dist );
                    vec3 finalColor = mix(nearColor, farColor, mixFactor);
                    
                    // Fade out alpha at horizon to blend with sky smoothly
                    float alpha = 1.0 - smoothstep(farFadeStart, farFadeEnd, dist);
                    
                    gl_FragColor = vec4( finalColor, alpha );
                }
            `,
            transparent: true,
            depthWrite: false
        });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -0.01;
        groundMesh.renderOrder = 0; // Behind grid and shadows
        scene.add(groundMesh);

        // ─── 7. 阴影接收平面 (VSM，仅在阴影区域可见) ────────────────────────────
        const shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 30),
            new THREE.ShadowMaterial({ opacity: 0.85 })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -0.01;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // ─── 8. 地面网格（蓝色 FUI 网格，AdditiveBlending）─────────────────────
        const gridTex = (() => {
            const res = 256;
            const cv = document.createElement("canvas");
            cv.width = cv.height = res;
            const c = cv.getContext("2d");
            c.fillStyle = "#000";
            c.fillRect(0, 0, res, res);
            c.strokeStyle = "rgba(0, 221, 255, 0.7)";
            c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(0, 0); c.lineTo(res, 0);
            c.moveTo(0, 0); c.lineTo(0, res);
            c.stroke();
            c.fillStyle = "rgba(0, 238, 255, 1.0)";
            c.fillRect(0, 0, 6, 6);
            const tex = new THREE.CanvasTexture(cv);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(200, 200);
            tex.anisotropy = 16;
            return tex;
        })();

        const gridPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshBasicMaterial({
                map: gridTex,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                opacity: 0.4,
                fog: true,
            })
        );
        gridPlane.rotation.x = -Math.PI / 2;
        gridPlane.position.y = 0.005;
        gridPlane.renderOrder = 2;
        scene.add(gridPlane);

        // ─── 9. HDR 环境贴图（日/夜各一套）─────────────────────────────────────
        const rgbeLoader = new RGBELoader(loadingManager);
        let nightEnvMap = null;
        let dayEnvMap = null;
        rgbeLoader.load("texture/qwantani_moonrise_puresky_4k.hdr", (tex) => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            nightEnvMap = tex;
            scene.environment = tex;
        });
        rgbeLoader.load("texture/citrus_orchard_road_puresky_4k.hdr", (tex) => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            dayEnvMap = tex;
        });

        // ─── 10. 材质工厂（完整 PBR，ORM 通道重排 + Detail Bump + 菲涅尔）────────
        const texLoader = new THREE.TextureLoader(loadingManager);
        const _matCache = {};

        function loadPBR(name, isTransparent = false) {
            const base = texLoader.load(`texture/Tex_${name}_Base.jpg`);
            base.flipY = false;
            base.anisotropy = 8;
            base.colorSpace = THREE.SRGBColorSpace;

            // 玻璃：Mask 贴图精确控制局部透明度
            if (isTransparent) {
                const glassMask = texLoader.load('texture/Tex__Glass_Mask.png');
                glassMask.flipY = false;
                const glassNorm = texLoader.load('texture/Tex_Glass_Normal.png');
                glassNorm.flipY = false;

                const glassMat = new THREE.MeshPhysicalMaterial({
                    map: base,
                    normalMap: glassNorm,
                    color: '#111115',
                    metalness: 0.1,
                    roughness: 0.05,
                    envMapIntensity: 1.0,
                    reflectivity: 0.9,
                    transparent: true,
                    opacity: 0.25,
                    side: THREE.DoubleSide,
                    depthWrite: true,
                });
                glassMat.onBeforeCompile = (shader) => {
                    shader.uniforms.tGlassMask = { value: glassMask };
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'void main() {',
                        'uniform sampler2D tGlassMask;\nvoid main() {'
                    );
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <opaque_fragment>',
                        `#include <opaque_fragment>
                     {
                       float maskVal = texture2D(tGlassMask, vMapUv).r;
                       gl_FragColor.a   = mix(gl_FragColor.a, 1.0, maskVal);
                       gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.3, maskVal);
                     }`
                    );
                };
                return glassMat;
            }

            // 灯具：自发光
            if (name === "Lamps") {
                return new THREE.MeshStandardMaterial({
                    map: base,
                    emissive: new THREE.Color('#ffffff'),
                    emissiveMap: base,
                    emissiveIntensity: 10,
                });
            }

            // 内饰件：哑光
            if (["Seat", "IP", "Int"].includes(name)) {
                return new THREE.MeshStandardMaterial({
                    map: base,
                    roughness: 0.6,
                    metalness: 0.4,
                    envMapIntensity: 0.1,
                });
            }

            // Logo：无法线贴图
            if (name === "Logo") {
                const logoOrm = texLoader.load('texture/Tex_Logo_ORM.jpg');
                logoOrm.flipY = false;
                return new THREE.MeshStandardMaterial({
                    map: base,
                    roughnessMap: logoOrm,
                    metalnessMap: logoOrm,
                    roughness: 1.0,
                    metalness: 1.0,
                    envMapIntensity: 1.0,
                });
            }

            // 车身：完整 PBR（ORM通道重排 + Detail Bump 拉丝 + 视角菲涅尔）
            if (name === "Body") {
                const norm = texLoader.load('texture/Tex_Body_Normal.png');
                norm.flipY = false;

                // ORM 通道重排：贴图 R=Roughness G=Metalness B=AO → Three.js R=AO G=Roughness B=Metalness
                const orm = texLoader.load('texture/Tex_Body_ORM.jpg', (tex) => {
                    const cv = document.createElement("canvas");
                    const img = tex.image;
                    cv.width = img.width; cv.height = img.height;
                    const ctx = cv.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    const d = ctx.getImageData(0, 0, cv.width, cv.height);
                    for (let i = 0; i < d.data.length; i += 4) {
                        const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
                        d.data[i] = b; d.data[i + 1] = r; d.data[i + 2] = g;
                    }
                    ctx.putImageData(d, 0, 0);
                    tex.image = cv; tex.needsUpdate = true;
                });
                orm.flipY = false;

                // Detail Bump：高频拉丝法线，打散高光
                const detailNorm = texLoader.load('texture/Tex_Body_Bump.jpg');
                detailNorm.flipY = false;
                detailNorm.wrapS = detailNorm.wrapT = THREE.RepeatWrapping;

                const bodyMat = new THREE.MeshPhysicalMaterial({
                    map: base,
                    normalMap: norm,
                    normalScale: new THREE.Vector2(1, -1), // Unity DirectX → Three.js OpenGL 约定
                    roughnessMap: orm,
                    metalnessMap: orm,
                    color: new THREE.Color('#BEBEBE'),
                    metalness: 0.2,
                    roughness: 1.0,
                    clearcoat: 0,
                    clearcoatRoughness: 1.0,
                    envMapIntensity: 0.35,
                });

                bodyMat.userData.shaderValues = {
                    detailNormalScale: 1.6, detailNormalTiling: 24.0,
                    aoIntensity: 0.2,
                    viewLitStrength: 0.15, viewLitPower: 1.0, highlitStrength: 0.1,
                };

                bodyMat.onBeforeCompile = (shader) => {
                    const sv = bodyMat.userData.shaderValues;
                    shader.uniforms.uAOIntensity = { value: sv.aoIntensity };
                    shader.uniforms.tORM = { value: orm };
                    shader.uniforms.tDetailNormal = { value: detailNorm };
                    shader.uniforms.uDetailNormalScale = { value: sv.detailNormalScale };
                    shader.uniforms.uDetailNormalTiling = { value: sv.detailNormalTiling };
                    shader.uniforms.uViewLitColor = { value: new THREE.Color(0.509, 0.499, 0.473) };
                    shader.uniforms.uViewLitStrength = { value: sv.viewLitStrength };
                    shader.uniforms.uViewLitPower = { value: sv.viewLitPower };
                    shader.uniforms.uHighlitColor = { value: new THREE.Color(1.0, 0.528, 0.231) };
                    shader.uniforms.uHighlitStrength = { value: sv.highlitStrength };

                    shader.fragmentShader = shader.fragmentShader.replace('void main() {',
                        `uniform float uAOIntensity;
                     uniform sampler2D tORM;
                     uniform sampler2D tDetailNormal;
                     uniform float uDetailNormalScale;
                     uniform float uDetailNormalTiling;
                     uniform vec3 uViewLitColor; uniform float uViewLitStrength; uniform float uViewLitPower;
                     uniform vec3 uHighlitColor; uniform float uHighlitStrength;
                     void main() {`
                    );

                    // Reoriented Normal Mapping：叠加 Detail Bump
                    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
                        `#include <normal_fragment_maps>
                     {
                       vec2 dUV = vMapUv * uDetailNormalTiling;
                       vec3 dN  = texture2D(tDetailNormal, dUV).rgb * 2.0 - 1.0;
                       dN.xy *= uDetailNormalScale;
                       normal = normalize(vec3(normal.xy + dN.xy, normal.z * dN.z));
                     }`
                    );

                    // 从 ORM UV1 采样 AO（不依赖 uv2）
                    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>',
                        `{
                       float aoVal = texture2D(tORM, vMapUv).r;
                       float ao    = (aoVal - 1.0) * uAOIntensity + 1.0;
                       reflectedLight.indirectDiffuse *= ao;
                       #if defined(USE_CLEARCOAT)
                         clearcoatSpecularIndirect *= ao;
                       #endif
                       #if defined(RE_IndirectSpecular)
                         float NdV = saturate(dot(geometryNormal, geometryViewDir));
                         reflectedLight.indirectSpecular *= computeSpecularOcclusion(NdV, ao, material.roughness);
                       #endif
                     }`
                    );

                    // 视角相关菲涅尔边缘光（模拟车漆高光"走味"效果）
                    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
                        `{
                       vec3 vDir = normalize(vViewPosition);
                       float rim = 1.0 - max(dot(normal, vDir), 0.0);
                       gl_FragColor.rgb += uViewLitColor * pow(rim, uViewLitPower) * uViewLitStrength;
                       gl_FragColor.rgb += uHighlitColor * pow(rim, 2.0) * uHighlitStrength * 0.05;
                     }
                     #include <dithering_fragment>`
                    );

                    bodyMat.userData.shader = shader;
                };

                window.bodyMaterial = bodyMat;
                return bodyMat;
            }

            // 默认 PBR（Wheel 等，含 ORM 通道重排）
            const defNorm = texLoader.load(`texture/Tex_${name}_Normal.jpg`);
            defNorm.flipY = false;
            const defOrm = texLoader.load(`texture/Tex_${name}_ORM.jpg`, (tex) => {
                const cv = document.createElement("canvas");
                const img = tex.image;
                cv.width = img.width; cv.height = img.height;
                const ctx = cv.getContext("2d");
                ctx.drawImage(img, 0, 0);
                const d = ctx.getImageData(0, 0, cv.width, cv.height);
                for (let i = 0; i < d.data.length; i += 4) {
                    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
                    d.data[i] = b; d.data[i + 1] = r; d.data[i + 2] = g;
                }
                ctx.putImageData(d, 0, 0);
                tex.image = cv; tex.needsUpdate = true;
            });
            defOrm.flipY = false;

            return new THREE.MeshStandardMaterial({
                map: base,
                normalMap: defNorm,
                normalScale: new THREE.Vector2(1.0, -1.0),
                roughnessMap: defOrm,
                metalnessMap: defOrm,
                aoMap: defOrm,
                roughness: 1.0,
                metalness: 1.0,
                envMapIntensity: 1.0,
            });
        }

        function loadPBRCached(name, isTransparent = false) {
            const key = name + (isTransparent ? '_T' : '');
            if (!_matCache[key]) _matCache[key] = loadPBR(name, isTransparent);
            return _matCache[key];
        }

        // ─── 11. 模型加载 ────────────────────────────────────────────────────────
        new GLTFLoader(loadingManager).load("p7i.glb", (gltf) => {
            const model = gltf.scene;
            scene.add(model);
            const BLOOM_LAYER = 1;
            model.traverse((child) => {
                if (!child.isMesh) return;
                const n = child.name;
                child.castShadow = true;
                child.frustumCulled = false;

                if (n.startsWith("Body") || n.startsWith("Door")) {
                    child.material = loadPBRCached("Body");
                    child.layers.set(0);
                } else if (n.includes("Glass")) {
                    child.material = loadPBRCached("Glass", true);
                    child.layers.set(0);
                } else if (n.includes("Int")) {
                    child.material = loadPBRCached("Int");
                    child.layers.set(0);
                } else if (n.includes("IP")) {
                    child.material = loadPBRCached("IP");
                    child.layers.set(0);
                } else if (n.includes("Lamps")) {
                    const isRear = n.toLowerCase().includes('rear');
                    child.layers.set(BLOOM_LAYER); // 灯具加入 Bloom 层，形成自发光辉光
                    if (isRear) {
                        if (!_matCache['RearLamps']) {
                            const frontMat = loadPBRCached("Lamps");
                            _matCache['RearLamps'] = frontMat.clone();
                            _matCache['RearLamps'].color.set('#ff0000');
                            _matCache['RearLamps'].emissive.set('#ff2200');
                            _matCache['RearLamps'].emissiveMap = frontMat.map;
                            _matCache['RearLamps'].emissiveIntensity = 8.0;
                        }
                        child.material = _matCache['RearLamps'];
                    } else {
                        child.material = loadPBRCached("Lamps");
                        child.material.emissiveMap = child.material.map;
                        child.material.emissiveIntensity = 2.0;
                    }
                } else if (n.includes("Wheel")) {
                    child.material = loadPBRCached("Wheel");
                    child.layers.set(0);
                    if (!window.carWheels) window.carWheels = [];
                    window.carWheels.push(child);
                } else if (n.includes("Seat")) {
                    child.material = loadPBRCached("Seat");
                    child.layers.set(0);
                } else if (n.includes("Logo")) {
                    child.material = loadPBRCached("Logo");
                    child.layers.set(0);
                }
            });

            // 模型加载完成后应用默认主题
            setMode('day');
        });

        // ─── 12. 日/夜预设系统 ──────────────────────────────────────────────────
        let currentMode = 'day';

        const NIGHT_PRESET = {
            bg: '#0a0a12',
            skyTop: '#0a0a12', skyBottom: '#050508',
            groundNear: '#111115', groundFar: '#050508',
            horizonBlur: 0.8, groundDepth: 30.0, fogNear: 20, fogFar: 80,
            ambientColor: '#585F67', ambientIntensity: 0.26,
            hemiColor: '#585F67', hemiGround: '#111111', hemiIntensity: 0.15,
            mainColor: '#BEBEBE', mainIntensity: 1.0,
            wheelColor: '#4466aa', wheelIntensity: 0.4,
            dirColor: '#BEBEBE', dirIntensity: 0.4,
            shadowOpacity: 0.85, bloomStrength: 0.3, exposure: 1.0,
            bodyColor: '#BEBEBE', bodyMetalness: 0.2, bodyRoughness: 1.0,
            bodyClearcoat: 0, bodyClearcoatRoughness: 1.0, bodyEnvMapIntensity: 0.35,
            bodyDetailNormalScale: 1.6, bodyDetailNormalTiling: 24.0,
            bodyAOIntensity: 0.2, bodyViewLitStrength: 0.15, bodyViewLitPower: 1.0, bodyHighlitStrength: 0.1,
            glassColor: '#111115', glassOpacity: 0.35, glassEnvMap: 2.0,
            lampsEmissiveIntensity: 10,
            rearLampsColor: '#ff0000', rearLampsEmissive: '#ff2200', rearLampsEmissiveIntensity: 8,
            interiorEnvMap: 0.1, gridOpacity: 0.4,
        };

        const DAY_PRESET = {
            bg: '#4e567e',
            skyTop: '#bdcde5', skyBottom: '#ffffff',
            groundNear: '#e8eced', groundFar: '#f8f7f7',
            horizonBlur: 0.5, groundDepth: 50,
            fogNear: 30, fogFar: 180,
            ambientColor: '#e0e7f0', ambientIntensity: 1.76,
            hemiColor: '#ebedf4', hemiGround: '#738ac9', hemiIntensity: 2,
            mainColor: '#e7f1f9', mainIntensity: 5,
            wheelColor: '#333333', wheelIntensity: 0.4,
            dirColor: '#f0ceb7', dirIntensity: 5,
            shadowOpacity: 0.98, bloomStrength: 0.46, exposure: 0.7,
            bodyColor: '#636363', bodyMetalness: 0.79, bodyRoughness: 0.69,
            bodyClearcoat: 0, bodyClearcoatRoughness: 1, bodyEnvMapIntensity: 0.87,
            bodyDetailNormalScale: 0, bodyDetailNormalTiling: 24.0,
            bodyAOIntensity: 2, bodyViewLitStrength: 0.05, bodyViewLitPower: 4, bodyHighlitStrength: 0.75,
            glassColor: '#050505', glassOpacity: 0.24, glassEnvMap: 1.5,
            lampsEmissiveIntensity: 14.1,
            rearLampsColor: '#ff0000', rearLampsEmissive: '#ff2200', rearLampsEmissiveIntensity: 5.2,
            interiorEnvMap: 0.5, gridOpacity: 0,
        };

        function setMode(mode) {
            currentMode = mode;
            const isDark = mode === 'night';
            const P = isDark ? NIGHT_PRESET : DAY_PRESET;

            scene.background.set(P.bg);
            scene.fog.color.set(P.bg);
            scene.fog.near = P.fogNear;
            scene.fog.far = P.fogFar;

            if (isDark && nightEnvMap) scene.environment = nightEnvMap;
            else if (!isDark && dayEnvMap) scene.environment = dayEnvMap;

            ambientLight.color.set(P.ambientColor); ambientLight.intensity = P.ambientIntensity;
            hemiLight.color.set(P.hemiColor); hemiLight.groundColor.set(P.hemiGround); hemiLight.intensity = P.hemiIntensity;
            mainLight.color.set(P.mainColor); mainLight.intensity = P.mainIntensity;
            wheelLight.color.set(P.wheelColor); wheelLight.intensity = P.wheelIntensity;
            dirLight.color.set(P.dirColor); dirLight.intensity = P.dirIntensity;
            shadowPlane.material.opacity = P.shadowOpacity;
            bloomPass.strength = P.bloomStrength;
            renderer.toneMappingExposure = P.exposure;

            if (window.bodyMaterial) {
                const bm = window.bodyMaterial;
                bm.color.set(P.bodyColor); bm.metalness = P.bodyMetalness; bm.roughness = P.bodyRoughness;
                bm.clearcoat = P.bodyClearcoat; bm.clearcoatRoughness = P.bodyClearcoatRoughness;
                bm.envMapIntensity = P.bodyEnvMapIntensity;
                if (bm.userData.shader) {
                    bm.userData.shader.uniforms.uDetailNormalScale.value = P.bodyDetailNormalScale;
                    bm.userData.shader.uniforms.uDetailNormalTiling.value = P.bodyDetailNormalTiling;
                    bm.userData.shader.uniforms.uAOIntensity.value = P.bodyAOIntensity;
                    bm.userData.shader.uniforms.uViewLitStrength.value = P.bodyViewLitStrength;
                    bm.userData.shader.uniforms.uViewLitPower.value = P.bodyViewLitPower;
                    bm.userData.shader.uniforms.uHighlitStrength.value = P.bodyHighlitStrength;
                }
            }
            if (_matCache['Glass_T']) {
                _matCache['Glass_T'].color.set(P.glassColor);
                _matCache['Glass_T'].opacity = P.glassOpacity;
                _matCache['Glass_T'].envMapIntensity = P.glassEnvMap;
            }
            if (_matCache['Lamps']) _matCache['Lamps'].emissiveIntensity = P.lampsEmissiveIntensity;
            if (_matCache['RearLamps']) {
                _matCache['RearLamps'].color.set(P.rearLampsColor);
                _matCache['RearLamps'].emissive.set(P.rearLampsEmissive);
                _matCache['RearLamps'].emissiveIntensity = P.rearLampsEmissiveIntensity;
            }
            ['Int', 'IP', 'Seat'].forEach(k => {
                if (_matCache[k]) {
                    _matCache[k].envMapIntensity = P.interiorEnvMap;
                    if (P.interiorColor !== undefined) _matCache[k].color.set(P.interiorColor);
                    if (P.interiorRoughness !== undefined) _matCache[k].roughness = P.interiorRoughness;
                    if (P.interiorMetalness !== undefined) _matCache[k].metalness = P.interiorMetalness;
                }
            });
            gridPlane.material.opacity = P.gridOpacity;
        }

        // 在浏览器控制台调用 window.toggleMode() 或按 M 键切换日/夜
        window.toggleMode = () => setMode(currentMode === 'night' ? 'day' : 'night');
        document.addEventListener('keydown', (e) => {
            if (e.key === 'M' || e.key === 'm') window.toggleMode();
        });

        // ─── 13. 布局状态变化 → GSAP 摇臂相机动画 ──────────────────────────────
        let _camTween = null;
        let camTargets = {
            'state-a': { dist: 11.3, elev: 1.5, w: 1848 },
            'right': { dist: 12.8, elev: 5.5, w: 1232 },
            'scene-2-3': { dist: 12.8, elev: 5.5, w: 1232 },
            'scene-1-3': { dist: 21.0, elev: 14.5, w: 616 },
            'state-c': { dist: 21.0, elev: 14.5, w: 0 },
        };

        // 实时跟随手势拖拽
        window.addEventListener('app-scene-drag', (e) => {
            if (window.isDrivingMode) return; // 行驶机位下不随分屏改变视角
            if (_camTween) _camTween.kill();
            let sw = e.detail.width;
            let L, R;

            if (sw >= camTargets['scene-2-3'].w) { L = camTargets['state-a']; R = camTargets['scene-2-3']; }
            else if (sw >= camTargets['scene-1-3'].w) { L = camTargets['scene-2-3']; R = camTargets['scene-1-3']; }
            else { L = camTargets['scene-1-3']; R = camTargets['state-c']; }

            let progress = 0;
            if (L.w !== R.w) progress = (L.w - sw) / (L.w - R.w);
            progress = Math.max(0, Math.min(1, progress));

            const cur = readCraneSliders();
            const targetDist = L.dist + (R.dist - L.dist) * progress;
            const targetElev = L.elev + (R.elev - L.elev) * progress;

            applyCraneCamera(targetDist, targetElev, cur.az);

            const ctrlDist = document.getElementById('ctrl-distance');
            const ctrlElev = document.getElementById('ctrl-elevation');
            if (ctrlDist) { ctrlDist.value = targetDist.toFixed(1); document.getElementById('val-distance').innerText = targetDist.toFixed(1); }
            if (ctrlElev) { ctrlElev.value = targetElev.toFixed(1); document.getElementById('val-elevation').innerText = targetElev.toFixed(1) + '°'; }
        });

        window.addEventListener('app-state-change', (e) => {
            if (window.isDrivingMode) return; // 行驶机位下维持参数不变
            const snap = (e.detail && e.detail.snap) || 'state-a';
            // state-c 为全屏地图，车辆场景通常不显示或维持现状
            if (snap === 'state-c') return;

            const target = camTargets[snap] || camTargets['state-a'];
            if (_camTween) _camTween.kill();

            const cur = readCraneSliders();
            // 核心逻辑：继承当前旋转角度 (Azimuth)，只移动距离和俯仰角
            _camTween = gsap.to(cur, {
                dist: target.dist,
                elev: target.elev,
                az: cur.az, // 继承前一个状态的旋转角度
                duration: 0.6, // 和界面 CSS transition 持续时间匹配
                ease: "power3.out", // 匹配手势释放和点击跳变速度
                onUpdate() {
                    applyCraneCamera(cur.dist, cur.elev, cur.az);
                    const ctrlDist = document.getElementById('ctrl-distance');
                    const ctrlElev = document.getElementById('ctrl-elevation');
                    const ctrlAz = document.getElementById('ctrl-azimuth');
                    if (ctrlDist) {
                        ctrlDist.value = cur.dist.toFixed(1);
                        document.getElementById('val-distance').innerText = cur.dist.toFixed(1);
                    }
                    if (ctrlElev) {
                        ctrlElev.value = cur.elev.toFixed(1);
                        document.getElementById('val-elevation').innerText = cur.elev.toFixed(1) + '°';
                    }
                    if (ctrlAz) {
                        ctrlAz.value = cur.az.toFixed(0);
                        document.getElementById('val-azimuth').innerText = cur.az.toFixed(0) + '°';
                    }
                },
                onComplete() { _camTween = null; }
            });
        });

        // ─── 14. 点击 → 车门交互（精确点击，拖拽不触发）─────────────────────────
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let _clickDownX = 0, _clickDownY = 0;
        threeCanvas.addEventListener('pointerdown', (e) => {
            _clickDownX = e.clientX; _clickDownY = e.clientY;
        });
        window.addEventListener("click", (event) => {
            const dx = event.clientX - _clickDownX;
            const dy = event.clientY - _clickDownY;
            if (dx * dx + dy * dy > 25) return; // 移动超 5px → 判定为拖拽
            const rect = threeCanvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(scene.children, true);
            if (hits.length > 0) {
                let obj = hits[0].object;
                while (obj) {
                    if (obj.name.startsWith("Door_")) {
                        const isOpen = obj.userData.isOpen || false;
                        const angle = obj.name.includes("_L") ? -0.85 : 0.85;
                        gsap.to(obj.rotation, { y: isOpen ? 0 : angle, duration: 1.2, ease: "power2.inOut" });
                        obj.userData.isOpen = !isOpen;
                        break;
                    }
                    obj = obj.parent;
                }
            }
        });

        // ─── 15. 渲染器尺寸同步（随分屏容器变化）───────────────────────────────
        let _lastRenderW = 0, _lastRenderH = 0;
        function _syncRendererSize() {
            const w = sceneContainer.offsetWidth;
            const h = sceneContainer.offsetHeight;
            if (w > 0 && h > 0 && (w !== _lastRenderW || h !== _lastRenderH)) {
                renderer.setSize(w, h, true);
                camera.aspect = w / h;
                if (window.updateCameraShift) window.updateCameraShift();
                camera.updateProjectionMatrix();
                bloomComposer.setSize(w, h);
                finalComposer.setSize(w, h);
                bloomPass.resolution.set(w, h);
                _lastRenderW = w;
                _lastRenderH = h;
            }
        }
        window.addEventListener('resize', _syncRendererSize);

        // Global variables to store camera state before entering driving mode
        let _preDrivingState = null;

        window.returnToPView = function () {
            if (!window.isDrivingMode || !_preDrivingState) return;
            window.isDrivingMode = false;

            const statusLeftBtn = document.getElementById('status-left-btn');
            if (statusLeftBtn) statusLeftBtn.classList.remove('active-driving');

            // Re-show NGP slide widget and others
            const goHomeWidget = document.getElementById('go-home-widget');
            const navItemSearch = document.querySelector('.nav-item-search');
            const navItemShortcuts = document.querySelector('.nav-item-shortcuts');
            const goHomeFill = document.getElementById('go-home-fill');

            if (goHomeWidget) {
                goHomeWidget.classList.remove('dismissed');
                goHomeWidget.classList.remove('activated-full');
                goHomeWidget.classList.remove('activated-glow');
                goHomeWidget.classList.remove('activated-inner');
                // Reset slide widget width smoothly or immediately
                if (goHomeFill) {
                    goHomeFill.style.transition = 'none';
                    goHomeFill.style.width = '104px';
                }
            }
            if (navItemSearch) navItemSearch.classList.remove('shifted-up');
            if (navItemShortcuts) navItemShortcuts.classList.remove('shifted-up');

            const cur = {
                dist: parseFloat(document.getElementById('ctrl-distance').value) || 26.9,
                elev: parseFloat(document.getElementById('ctrl-elevation').value) || 23.5,
                az: parseFloat(document.getElementById('ctrl-azimuth').value) || 180,
                focal: parseFloat(document.getElementById('ctrl-focal').value) || 20,
                shiftX: _camShiftX || 0,
                shiftY: _camShiftY || 0
            };

            gsap.to(cur, {
                dist: _preDrivingState.dist,
                elev: _preDrivingState.elev,
                az: _preDrivingState.az,
                focal: _preDrivingState.focal,
                shiftX: _preDrivingState.shiftX,
                shiftY: _preDrivingState.shiftY,
                duration: 2.0,
                ease: "power2.inOut",
                onUpdate() {
                    applyCraneCamera(cur.dist, cur.elev, cur.az);
                    camera.fov = focalToFov(cur.focal);
                    _camShiftX = cur.shiftX;
                    _camShiftY = cur.shiftY;
                    if (window.updateCameraShift) window.updateCameraShift();

                    const ctrlDist = document.getElementById('ctrl-distance');
                    const ctrlElev = document.getElementById('ctrl-elevation');
                    const ctrlAz = document.getElementById('ctrl-azimuth');
                    const ctrlFocal = document.getElementById('ctrl-focal');
                    const ctrlShiftX = document.getElementById('ctrl-shift-x');
                    const ctrlShiftY = document.getElementById('ctrl-shift-y');

                    if (ctrlDist) { ctrlDist.value = cur.dist.toFixed(1); document.getElementById('val-distance').innerText = cur.dist.toFixed(1); }
                    if (ctrlElev) { ctrlElev.value = cur.elev.toFixed(1); document.getElementById('val-elevation').innerText = cur.elev.toFixed(1) + '°'; }
                    if (ctrlAz) { ctrlAz.value = cur.az.toFixed(0); document.getElementById('val-azimuth').innerText = cur.az.toFixed(0) + '°'; }
                    if (ctrlFocal) { ctrlFocal.value = cur.focal.toFixed(0); document.getElementById('val-focal').innerText = cur.focal.toFixed(0) + 'mm'; }
                    if (ctrlShiftX) { ctrlShiftX.value = cur.shiftX.toFixed(0); document.getElementById('val-shift-x').innerText = cur.shiftX.toFixed(0); }
                    if (ctrlShiftY) { ctrlShiftY.value = cur.shiftY.toFixed(0); document.getElementById('val-shift-y').innerText = cur.shiftY.toFixed(0); }
                }
            });
        };

        window.transitionToDrivingMode = function () {
            window.isDrivingMode = true;
            updateCameraLimits();

            const cur = {
                dist: parseFloat(document.getElementById('ctrl-distance').value) || 11.3,
                elev: parseFloat(document.getElementById('ctrl-elevation').value) || 1.5,
                az: parseFloat(document.getElementById('ctrl-azimuth').value) || 126,
                focal: parseFloat(document.getElementById('ctrl-focal').value) || 59,
                shiftX: _camShiftX || 0,
                shiftY: _camShiftY || 0
            };

            // Save state to restore later
            _preDrivingState = { ...cur };

            gsap.to(cur, {
                dist: 26.9,
                elev: 23.5,
                az: 180,
                focal: 20,
                shiftX: 0,
                shiftY: -158,
                duration: 2.0,
                ease: "power2.inOut",
                onUpdate() {
                    applyCraneCamera(cur.dist, cur.elev, cur.az);

                    camera.fov = focalToFov(cur.focal);

                    _camShiftX = cur.shiftX;
                    _camShiftY = cur.shiftY;
                    if (window.updateCameraShift) window.updateCameraShift();

                    const ctrlDist = document.getElementById('ctrl-distance');
                    const ctrlElev = document.getElementById('ctrl-elevation');
                    const ctrlAz = document.getElementById('ctrl-azimuth');
                    const ctrlFocal = document.getElementById('ctrl-focal');
                    const ctrlShiftX = document.getElementById('ctrl-shift-x');
                    const ctrlShiftY = document.getElementById('ctrl-shift-y');

                    if (ctrlDist) { ctrlDist.value = cur.dist.toFixed(1); document.getElementById('val-distance').innerText = cur.dist.toFixed(1); }
                    if (ctrlElev) { ctrlElev.value = cur.elev.toFixed(1); document.getElementById('val-elevation').innerText = cur.elev.toFixed(1) + '°'; }
                    if (ctrlAz) { ctrlAz.value = cur.az.toFixed(0); document.getElementById('val-azimuth').innerText = cur.az.toFixed(0) + '°'; }
                    if (ctrlFocal) { ctrlFocal.value = cur.focal.toFixed(0); document.getElementById('val-focal').innerText = cur.focal.toFixed(0) + 'mm'; }
                    if (ctrlShiftX) { ctrlShiftX.value = cur.shiftX.toFixed(0); document.getElementById('val-shift-x').innerText = cur.shiftX.toFixed(0); }
                    if (ctrlShiftY) { ctrlShiftY.value = cur.shiftY.toFixed(0); document.getElementById('val-shift-y').innerText = cur.shiftY.toFixed(0); }
                }
            });
        };

        // ─── 16. 渲染循环 ────────────────────────────────────────────────────────
        window.carAnimState = { wheelSpeed: 0 };

        function animate() {
            requestAnimationFrame(animate);
            _syncRendererSize();
            controls.update();

            // 动态车轮旋转 (沿着X轴)
            if (window.carWheels && window.carAnimState.wheelSpeed > 0) {
                window.carWheels.forEach(w => w.rotateX(window.carAnimState.wheelSpeed));
            }
const originalBg = scene.background;
    scene.background = new THREE.Color(0x000000);
            // 1. 设置 Bloom 相机只渲染图层 1 (发光层)
    camera.layers.set(BLOOM_LAYER);
    bloomComposer.render();
scene.background = originalBg;
    // 2. 恢复相机渲染全部图层 (0 和 1)
    camera.layers.enable(0); 
    camera.layers.enable(BLOOM_LAYER);
    finalComposer.render();
        }
        animate();

        // ─── 17. 车辆进场与主时间轴 (Entry Sequence) ─────────────────────────
        window.startEntrySequence = function () {
            // 阶段 0：瞬移到靠前的图1机位
            const cur = readCraneSliders();
            cur.dist = 8.0;   // 距离更近
            cur.elev = 0.5;   // 角度更低
            cur.az = 145;     // 更靠近正脸
            applyCraneCamera(cur.dist, cur.elev, cur.az);
            window.carAnimState.wheelSpeed = 0.25; // 启动高速旋转

            // 这边同步一下控制参数防止跳变
            requestAnimationFrame(() => {
                document.getElementById('ctrl-distance').value = cur.dist;
                document.getElementById('ctrl-elevation').value = cur.elev;
                document.getElementById('ctrl-azimuth').value = cur.az;
            });

            // 阶段 1：3秒进场 + 车轮刹停 (进入图2标准视角)
            gsap.to(cur, {
                dist: 11.3,
                elev: 1.5,
                az: 126,
                duration: 3.0,
                ease: "power2.out",
                onUpdate() {
                    applyCraneCamera(cur.dist, cur.elev, cur.az);
                    document.getElementById('ctrl-distance').value = cur.dist.toFixed(1);
                    document.getElementById('val-distance').innerText = cur.dist.toFixed(1);
                    document.getElementById('ctrl-elevation').value = cur.elev.toFixed(1);
                    document.getElementById('val-elevation').innerText = cur.elev.toFixed(1) + '°';
                    document.getElementById('ctrl-azimuth').value = cur.az.toFixed(0);
                    document.getElementById('val-azimuth').innerText = cur.az.toFixed(0) + '°';
                }
            });

            gsap.to(window.carAnimState, {
                wheelSpeed: 0,
                duration: 3.0,
                ease: "power2.out"
            });

            // 阶段 2 & 3：停稳 4秒 后，触发UI隐去和53度环视
            setTimeout(() => {
                const uiToHide = document.querySelectorAll('.weather-text, .good-morning');
                uiToHide.forEach(el => {
                    el.style.transition = 'opacity 1.5s ease-out';
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                    setTimeout(() => { el.style.display = 'none'; }, 1500);
                });

                // Show the red arrow UI faster (after fading out the initial ones)
                canvas.classList.add('ui-ready');
                const redUI = document.querySelectorAll('.nav-item-base');
                redUI.forEach(el => {
                    el.style.transition = 'opacity 0.8s ease-in 0.5s';
                    setTimeout(() => { el.style.transition = ''; }, 1500);
                });

                camTargets['state-a'].dist = 11.3;
                camTargets['state-a'].elev = 1.5;

                const cur2 = readCraneSliders();
                gsap.to(cur2, {
                    dist: camTargets['state-a'].dist,
                    elev: camTargets['state-a'].elev,
                    az: 53,
                    duration: 1.5,
                    ease: "power2.inOut",
                    onUpdate() {
                        applyCraneCamera(cur2.dist, cur2.elev, cur2.az);
                        document.getElementById('ctrl-distance').value = cur2.dist.toFixed(1);
                        document.getElementById('val-distance').innerText = cur2.dist.toFixed(1);
                        document.getElementById('ctrl-elevation').value = cur2.elev.toFixed(1);
                        document.getElementById('val-elevation').innerText = cur2.elev.toFixed(1) + '°';
                        document.getElementById('ctrl-azimuth').value = cur2.az.toFixed(0);
                        document.getElementById('val-azimuth').innerText = cur2.az.toFixed(0) + '°';
                    }
                });
            }, 7000); // 3s进场动作 + 4s静止维持 = 总计7s后触发
        };

        // ─── 18. UI Control Bindings ───────────────────────────────────────────
        function bindColor(id, obj, prop) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', e => {
                if (obj.color) obj.color.set(e.target.value);
                else if (obj.value && obj.value.isColor) obj.value.set(e.target.value);
                else obj.set(e.target.value);

                const textId = id.replace('ctrl-', 'val-');
                const textEl = document.getElementById(textId);
                if (textEl) textEl.innerText = e.target.value;
            });
        }
        function bindVal(id, obj, prop, isUniform = false, textId = null) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                if (textId) document.getElementById(textId).innerText = val;

                if (isUniform) {
                    if (obj.userData && obj.userData.shader) {
                        obj.userData.shader.uniforms[prop].value = val;
                    } else if (obj.uniforms) {
                        obj.uniforms[prop].value = val;
                    } else if (obj.value !== undefined) {
                        obj.value = val;
                    }
                } else {
                    obj[prop] = val;
                }
            });
        }


        // 新增的天空和地面控制
        bindColor('ctrl-sky-top', skyUniforms.topColor);
        bindColor('ctrl-sky-bottom', skyUniforms.bottomColor);
        bindColor('ctrl-ground-near', groundUniforms.nearColor);
        bindColor('ctrl-ground-far', groundUniforms.farColor);
        bindVal('ctrl-horizon-blur', groundUniforms.horizonBlur, '', true, 'val-horizon-blur');
        bindVal('ctrl-ground-depth', groundUniforms.groundDepth, '', true, 'val-ground-depth');

        // 光影与环境 Lighting & Env
        document.getElementById('ctrl-bg').addEventListener('input', e => {
            scene.background.set(e.target.value);
            scene.fog.color.set(e.target.value);
        });
        bindColor('ctrl-ambient-color', ambientLight, 'color');
        bindVal('ctrl-ambient-int', ambientLight, 'intensity', false, 'val-ambient-int');

        bindColor('ctrl-hemi-color', hemiLight, 'color');
        document.getElementById('ctrl-hemi-ground').addEventListener('input', e => {
            hemiLight.groundColor.set(e.target.value);
        });
        bindVal('ctrl-hemi-int', hemiLight, 'intensity', false, 'val-hemi-int');

        bindColor('ctrl-main-color', mainLight, 'color');
        bindVal('ctrl-main-int', mainLight, 'intensity', false, 'val-main-int');

        bindColor('ctrl-wheel-color', wheelLight, 'color');
        bindVal('ctrl-wheel-int', wheelLight, 'intensity', false, 'val-wheel-int');

        bindColor('ctrl-dir-color', dirLight, 'color');
        bindVal('ctrl-dir-int', dirLight, 'intensity', false, 'val-dir-int');

        bindVal('ctrl-shadow-opacity', shadowPlane.material, 'opacity', false, 'val-shadow-opacity');
        bindVal('ctrl-bloom', bloomPass, 'strength', false, 'val-bloom');
        bindVal('ctrl-exposure', renderer, 'toneMappingExposure', false, 'val-exposure');
        bindVal('ctrl-grid', gridPlane.material, 'opacity', false, 'val-grid');

        // 车漆质感 Car Paint (Need to check when bodyMaterial is ready)
        const checkBodyMat = setInterval(() => {
            if (window.bodyMaterial) {
                clearInterval(checkBodyMat);
                bindColor('ctrl-body-color', window.bodyMaterial, 'color');
                bindVal('ctrl-body-metal', window.bodyMaterial, 'metalness', false, 'val-body-metal');
                bindVal('ctrl-body-rough', window.bodyMaterial, 'roughness', false, 'val-body-rough');
                bindVal('ctrl-body-cc', window.bodyMaterial, 'clearcoat', false, 'val-body-cc');
                bindVal('ctrl-body-ccr', window.bodyMaterial, 'clearcoatRoughness', false, 'val-body-ccr');
                bindVal('ctrl-body-env', window.bodyMaterial, 'envMapIntensity', false, 'val-body-env');

                bindVal('ctrl-body-ao', window.bodyMaterial, 'uAOIntensity', true, 'val-body-ao');
                bindVal('ctrl-body-normal', window.bodyMaterial, 'uDetailNormalScale', true, 'val-body-normal');
                bindVal('ctrl-body-viewlit', window.bodyMaterial, 'uViewLitStrength', true, 'val-body-viewlit');
                bindVal('ctrl-body-highlit', window.bodyMaterial, 'uHighlitStrength', true, 'val-body-highlit');
            }
        }, 500);

        // 放射与材质 Emissive & Mats
        const checkMats = setInterval(() => {
            if (_matCache['Lamps'] && _matCache['RearLamps'] && _matCache['Glass_T'] && _matCache['Int']) {
                clearInterval(checkMats);
                bindVal('ctrl-lamps-int', _matCache['Lamps'], 'emissiveIntensity', false, 'val-lamps-int');

                document.getElementById('ctrl-rear-color').addEventListener('input', e => {
                    _matCache['RearLamps'].emissive.set(e.target.value);
                });
                bindVal('ctrl-rear-int', _matCache['RearLamps'], 'emissiveIntensity', false, 'val-rear-int');

                document.getElementById('ctrl-glass-color').addEventListener('input', e => {
                    _matCache['Glass_T'].color.set(e.target.value);
                });
                bindVal('ctrl-glass-opacity', _matCache['Glass_T'], 'opacity', false, 'val-glass-opacity');

                document.getElementById('ctrl-int-color').addEventListener('input', e => {
                    const val = e.target.value;
                    document.getElementById('val-int-color').innerText = val;
                    ['Int', 'IP', 'Seat'].forEach(k => {
                        if (_matCache[k]) _matCache[k].color.set(val);
                    });
                });
                document.getElementById('ctrl-int-rough').addEventListener('input', e => {
                    const val = parseFloat(e.target.value);
                    document.getElementById('val-int-rough').innerText = val;
                    ['Int', 'IP', 'Seat'].forEach(k => {
                        if (_matCache[k]) _matCache[k].roughness = val;
                    });
                });
                document.getElementById('ctrl-int-metal').addEventListener('input', e => {
                    const val = parseFloat(e.target.value);
                    document.getElementById('val-int-metal').innerText = val;
                    ['Int', 'IP', 'Seat'].forEach(k => {
                        if (_matCache[k]) _matCache[k].metalness = val;
                    });
                });
                document.getElementById('ctrl-int-env').addEventListener('input', e => {
                    const val = parseFloat(e.target.value);
                    document.getElementById('val-int-env').innerText = val;
                    ['Int', 'IP', 'Seat'].forEach(k => {
                        if (_matCache[k]) _matCache[k].envMapIntensity = val;
                    });
                });
            }
        }, 500);


        // ─── 19. 写入工程参数 ──────────────────────────────────────────────────
        document.getElementById('save-btn').addEventListener('click', async () => {
            const getVal = id => parseFloat(document.getElementById(id).value);
            const getColor = id => document.getElementById(id).value;

            const code = `const ${currentMode === 'night' ? 'NIGHT_PRESET' : 'DAY_PRESET'} = {
            bg: '${getColor('ctrl-bg')}',
            skyTop: '${getColor('ctrl-sky-top')}', skyBottom: '${getColor('ctrl-sky-bottom')}',
            groundNear: '${getColor('ctrl-ground-near')}', groundFar: '${getColor('ctrl-ground-far')}',
            horizonBlur: ${getVal('ctrl-horizon-blur')}, groundDepth: ${getVal('ctrl-ground-depth')},
            fogNear: ${currentMode === 'night' ? 20 : 30}, fogFar: ${currentMode === 'night' ? 80 : 180},
            ambientColor: '${getColor('ctrl-ambient-color')}', ambientIntensity: ${getVal('ctrl-ambient-int')},
            hemiColor: '${getColor('ctrl-hemi-color')}', hemiGround: '${getColor('ctrl-hemi-ground')}', hemiIntensity: ${getVal('ctrl-hemi-int')},
            mainColor: '${getColor('ctrl-main-color')}', mainIntensity: ${getVal('ctrl-main-int')},
            wheelColor: '${getColor('ctrl-wheel-color')}', wheelIntensity: ${getVal('ctrl-wheel-int')},
            dirColor: '${getColor('ctrl-dir-color')}', dirIntensity: ${getVal('ctrl-dir-int')},
            shadowOpacity: ${getVal('ctrl-shadow-opacity')}, bloomStrength: ${getVal('ctrl-bloom')}, exposure: ${getVal('ctrl-exposure')},
            bodyColor: '${getColor('ctrl-body-color')}', bodyMetalness: ${getVal('ctrl-body-metal')}, bodyRoughness: ${getVal('ctrl-body-rough')},
            bodyClearcoat: ${getVal('ctrl-body-cc')}, bodyClearcoatRoughness: ${getVal('ctrl-body-ccr')}, bodyEnvMapIntensity: ${getVal('ctrl-body-env')},
            bodyDetailNormalScale: ${getVal('ctrl-body-normal')}, bodyDetailNormalTiling: 24.0,
            bodyAOIntensity: ${getVal('ctrl-body-ao')}, bodyViewLitStrength: ${getVal('ctrl-body-viewlit')}, bodyViewLitPower: ${currentMode === 'night' ? 1.0 : 4.0}, bodyHighlitStrength: ${getVal('ctrl-body-highlit')},
            glassColor: '${getColor('ctrl-glass-color')}', glassOpacity: ${getVal('ctrl-glass-opacity')}, glassEnvMap: ${currentMode === 'night' ? 2.0 : 1.5},
            lampsEmissiveIntensity: ${getVal('ctrl-lamps-int')},
            rearLampsColor: '#ff0000', rearLampsEmissive: '${getColor('ctrl-rear-color')}', rearLampsEmissiveIntensity: ${getVal('ctrl-rear-int')},
            interiorEnvMap: ${getVal('ctrl-int-env')}, gridOpacity: ${getVal('ctrl-grid')},
            interiorColor: '${getColor('ctrl-int-color')}', interiorRoughness: ${getVal('ctrl-int-rough')}, interiorMetalness: ${getVal('ctrl-int-metal')},
        };`;

            try {
                if (!window.showOpenFilePicker) throw new Error("File System Access API not supported");

                const handle = await window.showOpenFilePicker({
                    types: [{
                        description: 'HTML Files',
                        accept: { 'text/html': ['.html'] }
                    }],
                    multiple: false
                });

                const file = await handle[0].getFile();
                let text = await file.text();

                const regex = new RegExp(`const ${currentMode === 'night' ? 'NIGHT_PRESET' : 'DAY_PRESET'} = \\{[\\s\\S]*?\\};`);
                text = text.replace(regex, code.trim());

                const writable = await handle[0].createWritable();
                await writable.write(text);
                await writable.close();

                alert(`当前 ${currentMode} 模式的参数已成功覆盖写入至所选的 HTML 文件中！`);
            } catch (e) {
                console.warn(e);
                // Fallback to clipboard & download
                navigator.clipboard.writeText(code).catch(() => { });
                const blob = new Blob([code], { type: 'text/javascript' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `preset_${currentMode}.js`;
                a.click();
                alert(`由于浏览器安全限制，无法直接覆盖文件。\n已将参数复制到剪贴板并下载为 js 文件，请手动替换 index.html 中的对应位置。`);
            }
        });

        // sync UI with Presets
        const originalSetMode = setMode;
        setMode = function (mode) {
            originalSetMode(mode);
            const isDark = mode === 'night';
            const P = isDark ? NIGHT_PRESET : DAY_PRESET;

            const updateVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
                const text = document.getElementById(id.replace('ctrl-', 'val-'));
                if (text) text.innerText = val;
            }

            updateVal('ctrl-bg', P.bg);
            updateVal('ctrl-sky-top', P.skyTop);
            updateVal('ctrl-sky-bottom', P.skyBottom);
            updateVal('ctrl-ground-near', P.groundNear);
            updateVal('ctrl-ground-far', P.groundFar);
            updateVal('ctrl-horizon-blur', P.horizonBlur);
            updateVal('ctrl-ground-depth', P.groundDepth);

            if (skyUniforms) {
                skyUniforms.topColor.value.set(P.skyTop);
                skyUniforms.bottomColor.value.set(P.skyBottom);
                groundUniforms.nearColor.value.set(P.groundNear);
                groundUniforms.farColor.value.set(P.groundFar);
                groundUniforms.horizonBlur.value = P.horizonBlur;
                groundUniforms.groundDepth.value = P.groundDepth;
            }
            updateVal('ctrl-ambient-color', P.ambientColor);
            updateVal('ctrl-ambient-int', P.ambientIntensity);
            updateVal('ctrl-hemi-color', P.hemiColor);
            updateVal('ctrl-hemi-ground', P.hemiGround);
            updateVal('ctrl-hemi-int', P.hemiIntensity);
            updateVal('ctrl-main-color', P.mainColor);
            updateVal('ctrl-main-int', P.mainIntensity);
            updateVal('ctrl-wheel-color', P.wheelColor);
            updateVal('ctrl-wheel-int', P.wheelIntensity);
            updateVal('ctrl-dir-color', P.dirColor);
            updateVal('ctrl-dir-int', P.dirIntensity);

            updateVal('ctrl-shadow-opacity', P.shadowOpacity);
            updateVal('ctrl-bloom', P.bloomStrength);
            updateVal('ctrl-exposure', P.exposure);
            updateVal('ctrl-grid', P.gridOpacity);

            updateVal('ctrl-body-color', P.bodyColor);
            updateVal('ctrl-body-metal', P.bodyMetalness);
            updateVal('ctrl-body-rough', P.bodyRoughness);
            updateVal('ctrl-body-cc', P.bodyClearcoat);
            updateVal('ctrl-body-ccr', P.bodyClearcoatRoughness);
            updateVal('ctrl-body-env', P.bodyEnvMapIntensity);

            updateVal('ctrl-body-ao', P.bodyAOIntensity);
            updateVal('ctrl-body-normal', P.bodyDetailNormalScale);
            updateVal('ctrl-body-viewlit', P.bodyViewLitStrength);
            updateVal('ctrl-body-highlit', P.bodyHighlitStrength);

            updateVal('ctrl-lamps-int', P.lampsEmissiveIntensity);
            updateVal('ctrl-rear-color', P.rearLampsEmissive);
            updateVal('ctrl-rear-int', P.rearLampsEmissiveIntensity);
            updateVal('ctrl-glass-color', P.glassColor);
            updateVal('ctrl-glass-opacity', P.glassOpacity);
            updateVal('ctrl-int-env', P.interiorEnvMap);
            if (P.interiorColor !== undefined) updateVal('ctrl-int-color', P.interiorColor);
            if (P.interiorRoughness !== undefined) updateVal('ctrl-int-rough', P.interiorRoughness);
            if (P.interiorMetalness !== undefined) updateVal('ctrl-int-metal', P.interiorMetalness);
        };