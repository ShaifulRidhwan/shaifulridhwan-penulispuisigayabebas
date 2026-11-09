/* Versioned progression and resumable combat remain inside appassets local storage. */
(function(root){
const chapters=[
 {title:'I — BANGKITNYA CAHAYA',hero:'cahaya',lines:[['Cahaya','Aku menyalakan menara untuk melindungi kota. Mengapa lembah di bawahnya semakin gelap?'],['Gelap','Setiap cahaya mengambil sesuatu. Orang di lembah membayar keselamatanmu dengan malam tanpa akhir.'],['Cahaya','Jika pedang ini membuka jalan, aku akan berjalan turun. Bukan memaksa mereka mendongak.']],ending:'Cahaya memadamkan satu menara. Buat pertama kali, bintang kelihatan dari kota.'},
 {title:'II — BAYANGAN BULAN',hero:'gelap',lines:[['Gelap','Aku mencuri cahaya untuk lembah. Kini bayanganku sendiri menelan rumah mereka.'],['Cahaya','Kegelapan memberi perlindungan. Tetapi perlindungan yang tidak boleh ditinggalkan menjadi penjara.'],['Gelap','Kalau begitu, hentikan aku sebelum dendam memilih bagi pihakku.']],ending:'Gelap membuka pintu lembah. Mereka yang mahu pergi tidak lagi ditahan oleh bayangannya.'},
 {title:'III — GERHANA TERAKHIR',hero:'cahaya',boss:true,lines:[['Penjaga Gerhana','Aku menjaga imbangan dengan mengunci matahari dan bulan. Tiada perubahan, tiada kehilangan.'],['Gelap','Tiada pilihan juga. Kami bukan angka pada neracamu.'],['Cahaya','Kami akan menanggung akibatnya bersama. Lepaskan langit.']],ending:'Gerhana berakhir tanpa pemenang mutlak. Cahaya dan Gelap menyerahkan kuasa menara kepada mereka yang hidup di bawahnya.'}
];
const blank=()=>({version:3,xp:0,completed:[],matches:0,best:'D',resume:null});
function read(storage){try{const d=JSON.parse(storage.getItem('aksara-eclipse-v3'));if(d?.version===3&&Number.isFinite(d.xp)&&Array.isArray(d.completed))return {...blank(),...d};}catch{}return blank();}
function write(storage,data){try{storage.setItem('aksara-eclipse-v3',JSON.stringify(data));return true;}catch{return false;}}
function rank(match){const s=match.stats,score=(match.result==='MENANG'?50:10)+s.maxCombo*5+s.dodges*5+s.blocks*2-Math.min(40,s.taken/4);return score>=75?'S':score>=60?'A':score>=45?'B':score>=25?'C':'D';}
const unlocks=[{xp:80,id:'radiant',name:'Radiant Reserve · counter memberi +4 tenaga'},{xp:180,id:'shadow',name:'Shadow Flow · perfect dodge memulihkan 0.25s cooldown'}];
root.AksaraCampaign={chapters,read,write,rank,unlocks};if(typeof module!=='undefined')module.exports=root.AksaraCampaign;
})(typeof window!=='undefined'?window:globalThis);
