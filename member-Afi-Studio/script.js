// DATA MEMBER AFI STUDIO
// Data member sekarang dimuat dari member-Afi-Studio/member.json (lihat loadMembers di bawah)
let dataMember = {};

function getIcon(type) {
    const colors = {
        yt: "#FF0000",
        ig: "#E1306C",
        fb: "#1877F2",
        tk: "#000000",
        wa: "#25D366",
        dc: "#5865F2"
    };
    if (!colors[type]) return null;
    return {
        color: colors[type],
        svg: `<svg viewBox="0 0 512 512"><use href="../icons/social-icons.svg#icon-${type}"></use></svg>`
    };
}

function formatGenTitle(genId) {
    const m = String(genId).match(/^gen-(\d+)$/i);
    if (m) return `Generasi ke-${m[1]}`;
    return String(genId).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderMembers() {
    const wrap = document.getElementById('folder-group');
    if (!wrap) return;
    wrap.innerHTML = '';

    const keys = Object.keys(dataMember);
    keys.forEach((genId, i) => {
        const members = dataMember[genId] || [];
        const title = formatGenTitle(genId);
        const delay = (i * 0.05).toFixed(2);

        const folder = document.createElement('div');
        folder.className = 'folder';
        folder.style.animationDelay = delay + 's';
        folder.innerHTML = `<span>${title}</span>`;
        wrap.appendChild(folder);

        const container = document.createElement('div');
        container.id = genId;
        container.className = 'member-container';
        container.tabIndex = 0;
        container.addEventListener('keydown', e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const card = container.querySelector('.id-card');
            if (!card) return;
            const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
            const step = card.getBoundingClientRect().width + gap;
            container.scrollBy({ left: e.key === 'ArrowRight' ? step : -step, behavior: 'smooth' });
        });
        members.forEach((member, index) => {
            container.innerHTML += `
                <div class="id-card" style="animation-delay: ${index * 0.05}s;" onclick="openModal('${genId}', ${index})">
                    <img src="${member.foto}" class="profile-img" loading="lazy" decoding="async">
                    <div class="member-name-box"><span class="member-name">${member.nama}</span></div>
                </div>`;
        });
        wrap.appendChild(container);

        const divider = document.createElement('div');
        divider.className = 'folder-divider';
        divider.style.animationDelay = delay + 's';
        wrap.appendChild(divider);
    });
}

function openModal(gen, index) {
    const m = dataMember[gen][index];
    const modal = document.getElementById('memberModal');
    
    let socialHtml = "";
    for (let key in m.socials) {
        const link = m.socials[key];
        if (link && link.trim() !== "") {
            const iconData = getIcon(key);
            socialHtml += `<a href="${link}" target="_blank" class="social-btn" style="background-color: ${iconData.color}">${iconData.svg}</a>`;
        }
    }

    const infoKeys = Object.keys(m)
        .filter(k => /^info-\d+$/i.test(k))
        .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    const infoHtml = infoKeys.map(k => `<li>${m[k]}</li>`).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="modal-banner">
            <img src="${m.foto}" loading="lazy" decoding="async">
        </div>
        <div class="modal-details">
            <div class="status-icon">${m.identitas}</div>
            <h2 class="modal-name">${m.nama}</h2>
            <div class="modal-divider"></div> 
            <ul class="modal-subtext" style="list-style-type: disc; padding-left: 20px;">
                ${infoHtml}
            </ul>
            <div class="social-container">
                ${socialHtml}
            </div>
        </div>`;
    
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = "none", 400);
}

// Inisialisasi: ambil data member dari JSON, baru render
async function loadMembers() {
    try {
        const res = await fetch('/member-Afi-Studio/member.json');
        dataMember = await res.json();
    } catch (err) {
        console.error('Gagal memuat member-Afi-Studio/member.json:', err);
        dataMember = {};
    }
    renderMembers();
    document.dispatchEvent(new CustomEvent('membersLoaded'));
}
loadMembers();