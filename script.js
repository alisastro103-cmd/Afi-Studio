const NEWS_TEXTS = [
    "Afi Studio sedang <b>open member</b>.",
    "Pembukaan event Render akan dimulai pada tanggal <b>1 Mei 2026</b>.",
    "Menunggu Animasi serial \"Lintas Dimensi\" dari breent.",
    "Join <b>Saluran WhatsApp</b> kami!!"
];

const bannerData = [
            { img: "Banner1.jpg", url: "https://www.contoh.com/" },
            { img: "Banner2.jpg", url: "event/index.html" },
            { img: "Banner3.jpg", url: "event/index.html" },
            { img: "Banner4.jpg", url: "#" },
            { img: "Banner5.jpg", url: "#"}
        ];

const MODELS = [
    {
        name: 'Rig Mob Minecraft',
        caption: 'Rig Mob Minecraft not full it\'s free.',
        creator: '',
        converter: 'alisastro123',
        category: ['Minecraft', 'Rig', 'Mob', 'Free'], 
        thumb: 'https://i.postimg.cc/2qbcjDVp/thumbnail1.png',
        link: 'https://www.mediafire.com/file/ynm849b3g243pnc/Mob_Minecraft_Full.zip/file'
    },
    {
       name: 'Hospital Furniture',
        caption: 'Content hospital pack models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Minecraft', 'Furniture', 'Model'], 
        thumb: 'https://i.postimg.cc/qRPx1WBq/Hospital_Pack_Models.jpg',
        link: 'https://www.mediafire.com/file/xblgnyiy5hnsnk1/Hospital_Furniture_.zip/file'
     },
     {
       name: 'Classroom Map',
        caption: 'Classroom contains classroom',
        creator: 'IanAdhi & RidwanMC',
        converter: '',
        category: ['Minecraft', 'Map', 'Model', 'Aesthetic'], 
        thumb: 'https://i.postimg.cc/QNzbt9pj/Classroom_Map.jpg',
        link: 'https://www.mediafire.com/file/ou1x7ukjqwbfqwz/Classroom_Map_%252B_Furniture.zip/file'
      },
     {
       name: 'Classroom Pack',
        caption: 'Containts Classroom Pack Models',
        creator: 'IanAdhi',
        converter: '',
        category: ['Minecraft', 'Furniture', 'Model-pack'], 
        thumb: 'https://i.postimg.cc/9MKJvrbd/Classroom_Pack.jpg',
        link: 'https://www.mediafire.com/file/2jyagccxhuqx9j6/Classroom_Pack.zip/file'
     },  
     {
       name: 'Sofa Royal Furniture',
        caption: 'Containts sofa Royal models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Royal', 'Furniture', 'Aesthetic', 'ModelsPack'], 
        thumb: 'https://i.postimg.cc/yxhcvdbY/Sofa_Royal_Packs.jpg',
        link: 'https://www.mediafire.com/file/vwdirybg8l2fxjl/Sofa_Royal_Furniture.zip/file'
     },
       {
       name: 'Valentine Packs',
        caption: 'Containts Valentine Pack Models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Cosmetic', 'Furniture', 'Model-pack', 'Items'], 
        thumb: 'https://i.postimg.cc/rmXD3TW6/Valentine_Pack_models.jpg',
        link: 'https://www.mediafire.com/file/vou12hl26d3l0n1/Valentine_Pack.zip/file'
     },
     {
       name: 'Rig Afi V2',
        caption: 'Containts Valentine Pack Models',
        creator: 'IanAdhi',
        converter: '',
        category: ['Rig-Model', 'Ava', 'Model', 'Prisma3D'], 
        thumb: 'https://i.postimg.cc/hGVw881w/Afi_Rig_V2.jpg',
        link: 'https://youtu.be/8G6r_OuBpUw?si=ymUXbGYA0t_Hl9nO'
     }
];

// --- AKSEN WARNA ---
const ACCENTS = ['#99FFD9', '#C0FF8D', '#FF8AB5', '#D07FFF', '#FF0021', '#8DD1FF', '#7FFFF8', '#FFC97F'];
let currentModel = null, currentTheme = 'dark', currentAccent = '#99FFD9'; 

const CATEGORIES = ["Semua", "Furniture", "Map", "Item", "Rig"];
let activeCategory = "Semua";

// Merender tombol filter kategori
function renderCategoryButtons() {
    const container = document.getElementById('category-filter');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="filter-btn ${activeCategory === cat ? 'active' : ''}" 
                onclick="filterByCategory('${cat}')">
            ${cat}
        </button>
    `).join('');
}

// Fungsi filter berdasarkan kategori
function filterByCategory(cat) {
    activeCategory = cat;
    const titleElement = document.getElementById('category-title');
    if (titleElement) {
        titleElement.textContent = cat.toLowerCase() === "semua" ? "SEMUA ITEM" : cat.toUpperCase();
    }
    renderCategoryButtons();
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    renderModels(searchTerm);
}

// Merender teks berjalan (marquee)
function renderMarquee() {
    const marquee = document.getElementById('news-marquee');
    if (marquee) {
        // Jarak margin horizontal antar teks dirapatkan dari 45px ke 20px
        const separator = `<span style="color: var(--accent); margin: 0 20px; font-weight: bold; opacity: 0.8;">|</span>`;
        const joinedContent = NEWS_TEXTS.join(separator);
        marquee.innerHTML = `${separator}${joinedContent}${separator}`;
    }
}

// Merender kartu model ke grid utama
function renderModels(filter = '') {
    const grid = document.getElementById('content-grid');
    if (!grid) return;

    const filtered = MODELS.filter(m => {
        const s = filter.toLowerCase();
        const categoriesArray = Array.isArray(m.category) ? m.category : [m.category];
        
        const categoryMatch = activeCategory === "Semua" || 
            categoriesArray.some(c => c.toLowerCase() === activeCategory.toLowerCase());
            
        const textMatch = m.name.toLowerCase().includes(s) || 
            categoriesArray.join(' ').toLowerCase().includes(s) || 
            (m.converter && m.converter.toLowerCase().includes(s)) || 
            (m.creator && m.creator.toLowerCase().includes(s));
            
        return categoryMatch && textMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-center opacity-60">
                <i data-lucide="frown" style="width: 64px; height: 64px; margin-bottom: 16px;"></i>
                <p class="text-sm font-semibold">Coba cari yang lain dan coba lagi</p>
            </div>`;
    } else {
        grid.innerHTML = filtered.map(model => `
            <article class="model-card" onclick="openModal(${MODELS.indexOf(model)})">
                <img src="${model.thumb}" class="card-image" loading="lazy">
                <div class="card-content">
                    <div class="card-title">${model.name}</div>
                    <div class="card-caption">${model.caption}</div>
                </div>
            </article>
        `).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Fungsi Modal
function openModal(index) {
    currentModel = MODELS[index];
    const infoBox = document.getElementById('info-container');
    const modalThumb = document.getElementById('modal-thumb');
    
    if (modalThumb) modalThumb.src = currentModel.thumb;
    document.getElementById('modal-title').textContent = currentModel.name;
    document.getElementById('modal-caption').textContent = currentModel.caption;
    
    let infoHtml = '';
    if(currentModel.creator) infoHtml += `<div class="flex justify-between"><span>Creator:</span><b>${currentModel.creator}</b></div>`;
    if(currentModel.converter) infoHtml += `<div class="flex justify-between"><span>Converter:</span><b>${currentModel.converter}</b></div>`;
    if(currentModel.category) {
        const catText = Array.isArray(currentModel.category) ? currentModel.category.join(', ') : currentModel.category;
        infoHtml += `<div class="flex justify-between"><span>Category:</span><b>${catText}</b></div>`;
    }
    if (infoBox) infoBox.innerHTML = infoHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
}

// Pengaturan
function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.toggle('open');
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const lightBtn = document.getElementById('theme-light');
    const darkBtn = document.getElementById('theme-dark');
    if(lightBtn) lightBtn.style.borderColor = theme === 'light' ? currentAccent : 'var(--border)';
    if(darkBtn) darkBtn.style.borderColor = theme === 'dark' ? currentAccent : 'var(--border)';
}

function setAccent(color) {
    currentAccent = color;
    document.documentElement.style.setProperty('--accent', color);
    document.querySelectorAll('.accent-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === color);
    });
    setTheme(currentTheme);
    renderMarquee();
}

// Fungsi Download & Copy Link
function handleDownload() { 
    if (currentModel) window.open(currentModel.link, '_blank'); 
}

function handleCopyLink() {
    if (!currentModel) return;
    navigator.clipboard.writeText(currentModel.link).then(() => {
        const t = document.getElementById('toast');
        if (t) {
            t.classList.remove('translate-y-20');
            setTimeout(() => t.classList.add('translate-y-20'), 2000);
        }
    });
}

// Event Listeners
const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => renderModels(e.target.value));
}

const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', toggleSettings);
}

// Inisialisasi
(function init() {
    const container = document.getElementById('accent-dots');
    if (container) {
        ACCENTS.forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'accent-dot';
            dot.dataset.color = color;
            dot.style.background = color;
            dot.onclick = () => setAccent(color);
            container.appendChild(dot);
        });
    }
    renderCategoryButtons();
    renderModels();
    renderMarquee();
    setTheme('dark'); 
    if (typeof lucide !== 'undefined') lucide.createIcons();
})();
