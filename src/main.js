import * as THREE from 'three';

// --- CONFIGURAZIONE ---
const CONFIG = {
    // Colori
    ballColor: 0xff0055,   
    tileColor: 0xffffff,   
    goldColor: 0xffd700,   
    bgColor: 0x111111,
    
    // Gameplay
    initSpeed: 14.0,       
    maxSpeed: 30.0,        
    speedIncrement: 0.001, 
    
    // Fisica
    gravity: -25.0,        
    jumpForce: 12.0,       
    
    // Dimensioni
    laneWidth: 6,          
    tileDepth: 8.0, 
};

// --- VARIABILI GLOBALI ---
let scene, camera, renderer;
let ball;
let tiles = [];
let tilesSpawnedCount = 0; 
const clock = new THREE.Clock();

// Variabili Audio
let audioListener = null;
let audioLoader = null;
let audioContext = null;
let audioLayers = []; 
let currentLayerIndex = 0; 
let isAudioInitialized = false; 

// Variabili Gioco
let isPlaying = false;
let isGameOver = false;
let score = 0;
let currentSpeed = CONFIG.initSpeed;

// Variabili Fisica
let ballVelocityY = 0; 

// Input
let isDragging = false;
let previousPointerX = 0;

init();
animate();

function init() {
    // 1. SCENA
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgColor);
    scene.fog = new THREE.Fog(CONFIG.bgColor, 10, 60); 

    // 2. CAMERA
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    // Posizione iniziale coerente con l'update (Z = BallZ + 12)
    camera.position.set(0, 7, 12); 
    camera.lookAt(0, 0, -5);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.body.appendChild(renderer.domElement);

    // 4. LUCI
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // 5. PALLINA 
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshStandardMaterial({ 
        color: CONFIG.ballColor,
        roughness: 0.2,
        metalness: 0.5 
    });
    ball = new THREE.Mesh(geometry, material);
    
    // Partenza corretta: SULLA piattaforma (y=0)
    ball.position.set(0, 0, 0); 
    scene.add(ball);

    // Diamo subito la spinta iniziale verso l'alto
    ballVelocityY = CONFIG.jumpForce; 

    // 6. TILES INIZIALI
    createTile(0, 0); 
    // Generiamo tiles in avanti
    for (let i = 1; i < 20; i++) {
        spawnNextTile();
    }

    // 7. INPUT
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    
    document.addEventListener('touchstart', onTouchStart, {passive: false});
    document.addEventListener('touchmove', onTouchMove, {passive: false});
    document.addEventListener('touchend', onPointerUp);

    window.addEventListener('resize', onWindowResize);

    createUI();
}

// --- LOGICA MONDO ---

function createTile(x, z, isGold = false) {
    // MODIFICA 1: Larghezza ridotta per aumentare la difficoltà
    const width = 2.2; // Era 3.0
    const depth = CONFIG.tileDepth;
    const height = 0.5;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
        color: isGold ? CONFIG.goldColor : CONFIG.tileColor,
        emissive: isGold ? 0xaa6600 : 0x000000,
        emissiveIntensity: isGold ? 0.6 : 0.1
    });

    const tile = new THREE.Mesh(geometry, material);
    tile.position.set(x, -0.5, z);
    
    tile.userData = { isGold: isGold, hit: false };

    scene.add(tile);
    tiles.push(tile);
}

function spawnNextTile() {
    tilesSpawnedCount++;

    const lastTile = tiles[tiles.length - 1];
    
    // Tempo di volo esatto
    const flightTime = (2 * CONFIG.jumpForce) / Math.abs(CONFIG.gravity);
    
    // Distanza esatta + piccolo buffer
    const jumpDistance = (currentSpeed * flightTime) + 0.5;

    const zPos = lastTile.position.z - jumpDistance;

    // MODIFICA 2: Oro ogni 20 piattaforme
    const isGold = (tilesSpawnedCount % 20 === 0);

    let xPos = (Math.random() * CONFIG.laneWidth) - (CONFIG.laneWidth / 2);
    // All'inizio spostamenti dolci
    if (currentSpeed < 18) xPos = xPos * 0.6; 
    
    createTile(xPos, zPos, isGold);
}

// --- CONTROLLI & AUDIO INIT ---

function handleInputStart(clientX) {
    if (isGameOver) {
        resetGame();
        return;
    }
    
    if (!isAudioInitialized) {
        initAudioSystem();
        isAudioInitialized = true;
    }

    if (!isPlaying) {
        const overlay = document.getElementById('start-overlay');
        if (overlay) overlay.style.display = 'none';
        
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        audioLayers.forEach(sound => {
            if (sound.buffer && !sound.isPlaying) sound.play();
        });
        
        isPlaying = true;
    }

    isDragging = true;
    previousPointerX = clientX;
}

function handleInputMove(clientX) {
    if (!isDragging || !isPlaying || isGameOver) return;

    const deltaX = clientX - previousPointerX;
    const sensitivity = 0.025; 
    
    ball.position.x += deltaX * sensitivity;

    const limit = CONFIG.laneWidth / 2 + 1;
    ball.position.x = Math.max(-limit, Math.min(limit, ball.position.x));

    previousPointerX = clientX;
}

// Eventi
function onPointerDown(e) { handleInputStart(e.clientX); }
function onPointerMove(e) { handleInputMove(e.clientX); }
function onPointerUp() { isDragging = false; }

function onTouchStart(e) { 
    if(e.cancelable) e.preventDefault(); 
    handleInputStart(e.touches[0].clientX); 
}
function onTouchMove(e) { 
    if(e.cancelable) e.preventDefault(); 
    handleInputMove(e.touches[0].clientX); 
}

// --- AUDIO SYSTEM ---
function initAudioSystem() {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    audioContext = audioListener.context;
    audioLoader = new THREE.AudioLoader();
    
    const fileNames = ['other.mp3', 'bass.mp3', 'piano.mp3', 'vocals.mp3'];
    
    fileNames.forEach((file) => {
        const sound = new THREE.Audio(audioListener);
        audioLayers.push(sound);
        audioLoader.load(`./audio/${file}`, (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(0); 
            if (isPlaying) sound.play(); 
        });
    });
}

function unlockNextAudioLayer() {
    if (currentLayerIndex < audioLayers.length) {
        const layer = audioLayers[currentLayerIndex];
        if (layer) layer.setVolume(1);
        currentLayerIndex++;
    }
}

// --- GAME LOOP ---

function update(deltaTime) {
    if (!isPlaying) return;

    if (!isGameOver) {
        if (currentSpeed < CONFIG.maxSpeed) {
            currentSpeed += CONFIG.speedIncrement;
        }

        const moveStep = currentSpeed * deltaTime;
        
        // 1. Muovi pallina
        ball.position.z -= moveStep;
        
        // 2. Camera Incollata alla pallina (FIX DISTANZA)
        camera.position.z = ball.position.z + 12; 
    }

    // FISICA UPDATE
    ballVelocityY += CONFIG.gravity * deltaTime; 
    ball.position.y += ballVelocityY * deltaTime; 

    // CONTROLLO ATTERRAGGIO
    if (ball.position.y <= 0.4 && ballVelocityY < 0) {
        checkLanding();
    }

    // GAME OVER
    if (ball.position.y < -5) {
        triggerGameOver();
    }

    // PULIZIA TILES (Basata sulla posizione palla)
    if (tiles.length > 0 && tiles[0].position.z > ball.position.z + 10) {
        scene.remove(tiles[0]);
        tiles.shift();
        spawnNextTile();
    }
}

function checkLanding() {
    for (let tile of tiles) {
        // Controllo Z (Tolleranza ampia)
        const zDiff = Math.abs(tile.position.z - ball.position.z);
        const zLimit = (CONFIG.tileDepth / 2) + 0.8; 

        if (zDiff < zLimit) {
            
            // Controllo X (Hitbox laterale - MODIFICA 3)
            // Tolleranza ridotta a 1.4 perché la piattaforma è larga 2.2 (metà 1.1)
            // Se la palla (raggio 0.4) esce dal bordo, cadi.
            const xDiff = Math.abs(tile.position.x - ball.position.x);
            
            if (xDiff < 1.4) { 
                
                // RIMBALZO & MAGNETISMO
                ballVelocityY = CONFIG.jumpForce; 
                ball.position.y = 0; 
                
                // Reset preciso
                ball.position.z = tile.position.z; 

                // Animazione Tile
                tile.position.y -= 0.4;
                setTimeout(() => { tile.position.y += 0.4 }, 80);

                if (!tile.userData.hit) {
                    tile.userData.hit = true;
                    if (tile.userData.isGold) {
                        score += 10;
                        unlockNextAudioLayer();
                        showFloatingText("+10", 0xffd700);
                    } else {
                        score += 1;
                        showFloatingText("+1", 0xffffff);
                    }
                    document.getElementById('score-el').innerText = score;
                }
                return;
            }
        }
    }
}


// --- UI & UTILS ---

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    if(audioContext) audioContext.suspend();
    document.getElementById('game-over-ui').style.display = 'flex';
}

function resetGame() {
    isGameOver = false;
    isPlaying = true;
    score = 0;
    currentSpeed = CONFIG.initSpeed;
    document.getElementById('score-el').innerText = "0";
    document.getElementById('game-over-ui').style.display = 'none';

    // FIX RESET
    ball.position.set(0, 0, 0);
    ballVelocityY = CONFIG.jumpForce; 

    // Reset Camera
    camera.position.set(0, 7, 12); 

    // Audio Reset
    currentLayerIndex = 0;
    audioLayers.forEach(l => l.setVolume(0));
    if(audioContext) audioContext.resume();

    // Reset completo tiles
    tiles.forEach(t => scene.remove(t));
    tiles = [];
    tilesSpawnedCount = 0; 
    
    createTile(0, 0);
    for (let i = 1; i < 20; i++) {
        spawnNextTile();
    }
}

function showFloatingText(text, colorHex) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.color = '#' + new THREE.Color(colorHex).getHexString();
    el.style.fontWeight = 'bold';
    el.style.fontSize = '24px';
    el.style.fontFamily = 'Arial';
    el.style.left = '50%';
    el.style.top = '40%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.transition = 'top 1s, opacity 1s';
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.top = '30%';
        el.style.opacity = '0';
    }, 50);
    setTimeout(() => el.remove(), 1000);
}

function createUI() {
    if (document.getElementById('score-el')) return;

    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'score-el';
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '40px';
    scoreDiv.style.width = '100%';
    scoreDiv.style.textAlign = 'center';
    scoreDiv.style.color = 'white';
    scoreDiv.style.fontSize = '40px';
    scoreDiv.style.fontWeight = 'bold';
    scoreDiv.style.fontFamily = 'Arial';
    scoreDiv.innerText = "0";
    document.body.appendChild(scoreDiv);

    const startDiv = document.createElement('div');
    startDiv.id = 'start-overlay';
    startDiv.style.position = 'absolute';
    startDiv.style.top = '0';
    startDiv.style.left = '0';
    startDiv.style.width = '100%';
    startDiv.style.height = '100%';
    startDiv.style.backgroundColor = 'rgba(0,0,0,0.85)';
    startDiv.style.color = 'white';
    startDiv.style.display = 'flex';
    startDiv.style.flexDirection = 'column';
    startDiv.style.justifyContent = 'center';
    startDiv.style.alignItems = 'center';
    startDiv.innerHTML = "<h1 style='font-size:40px; margin:0;'>TILES DROP</h1><p>Tieni premuto e trascina</p>";
    document.body.appendChild(startDiv);

    const goDiv = document.createElement('div');
    goDiv.id = 'game-over-ui';
    goDiv.style.display = 'none';
    goDiv.style.position = 'absolute';
    goDiv.style.top = '0';
    goDiv.style.left = '0';
    goDiv.style.width = '100%';
    goDiv.style.height = '100%';
    goDiv.style.backgroundColor = 'rgba(100,0,0,0.8)';
    goDiv.style.color = 'white';
    goDiv.style.flexDirection = 'column';
    goDiv.style.justifyContent = 'center';
    goDiv.style.alignItems = 'center';
    goDiv.innerHTML = "<h1>GAME OVER</h1><p>Tocca per riprovare</p>";
    document.body.appendChild(goDiv);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta(); // Tempo reale trascorso dall'ultimo frame
    // Se il telefono si blocca per un secondo, non vogliamo un salto temporale enorme.
    // Limitiamo il delta a massimo 0.1 secondi (10fps minimi) per sicurezza fisica.
    const safeDelta = Math.min(delta, 0.1);

    update(safeDelta); // Passiamo il tempo vero alla funzione update
    renderer.render(scene, camera);
}