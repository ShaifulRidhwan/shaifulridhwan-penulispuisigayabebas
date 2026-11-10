package my.aksara.engine.chess;

/** Offline Malay narrative planner. It cannot choose moves or invent tactical classifications. */
public final class QueenDialogue {
    public record Line(String text,int priority,boolean positionSpecific) {}
    private long lastSpoken=-60000;
    private int variation;
    private int lastPriority;
    private String previous="";
    public Line plan(ChessSession game,String event,UciEngine.Analysis analysis,long now) {
        int priority=switch(event) {case "mate","draw" -> 5;case "check","double_check","promotion" -> 4;case "opening" -> 3;default -> 1;};
        if(priority<4 && now-lastSpoken<18000) return null;
        if(priority==4 && lastPriority>=4 && now-lastSpoken<5000) return null;
        if((event.equals("check") || event.equals("double_check")) && !game.inCheck()) return null;
        if((event.equals("mate") || event.equals("draw")) && game.end()==ChessSession.End.PLAYING) return null;
        String text=null;boolean specific=true;
        switch(event) {
            case "opening" -> {specific=false;text=pick("Selamat datang ke wilayah Gelap. Mari kita lihat sejauh mana Cahaya mampu bertahan.","Papan telah tersedia. Bawa Cahayamu. Aku menanti langkah pertamamu.");}
            case "mate" -> {specific=false;text=game.result().equals("0-1")?pick("Cahaya telah padam. Tetapi keberanianmu... aku akui.","Pertempuran ini milik Gelap. Kembali apabila kau bersedia."):pick("Kau berjaya menewaskan Gelap. Nikmati kemenangan ini.","Pertahananmu bertahan hingga akhir. Kemenangan ini memang milikmu.");}
            case "draw" -> {specific=false;text=pick("Kali ini, Cahaya dan Gelap berdiri seimbang. Kita akhiri dengan seri.","Tiada yang tumbang hari ini. Pertemuan ini berakhir dengan seri.");}
            case "double_check" -> text="Dua ancaman serentak menuju raja. Pilih langkah sah dengan cermat.";
            case "check" -> text=game.turn()==com.github.bhlangonijr.chesslib.Side.WHITE?pick("Rajamu dalam ancaman. Pilih pertahananmu dengan teliti.","Check. Ruang untuk rajamu semakin sempit."):pick("Kau mengancam rajaku. Baiklah, mari kita lihat pertahananku.","Check yang menarik. Aku akan mencari jawapannya.");
            case "promotion" -> text=pick("Satu pawn telah mencapai takhtanya. Kini kedudukan ini berubah.","Buah baharu telah lahir. Perhatikan kuasanya di papan.");
            case "declineDraw" -> {specific=false;priority=3;text="Aku menolak tawaran seri itu. Masih ada pertempuran untuk diteruskan.";}
            default -> {
                if(analysis!=null && analysis.depth()>=14) {
                    if(analysis.mate()!=null && analysis.mate()>0) {
                        priority=4;text="Carian enjin mengesan laluan mate dalam "+analysis.mate()+" langkah. Pertahananmu kini sangat penting.";
                    } else if(analysis.centipawns()!=null && analysis.centipawns()>=200)
                        text=pick("Penilaian kini memihak kepada Gelap. Namun aku belum menganggap pertempuran ini selesai.","Aku memiliki kelebihan dalam carian ini. Mari lihat pertahananmu.");
                    else if(analysis.centipawns()!=null && analysis.centipawns()<=-200)
                        text=pick("Cahaya memegang kelebihan. Aku masih mencari pertahanan terbaik.","Kedudukanmu lebih baik menurut carian ini. Aku perlu lebih teliti.");
                }
                if(text==null && event.equals("capture"))text=pick("Satu buah telah gugur. Papan masih menyimpan banyak kemungkinan.","Pertukaran itu telah berlaku. Pertimbangkan langkah seterusnya dengan tenang.");
            }
        }
        if(text==null || text.equals(previous)) return null;
        lastSpoken=now;lastPriority=priority;previous=text;return new Line(text,priority,specific);
    }
    public void reset() {lastSpoken=-60000;previous="";}
    private String pick(String a,String b) {return variation++%2==0?a:b;}
}
