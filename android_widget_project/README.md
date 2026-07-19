# Tadilat Takip - Android Widget Projesi ⚒️

Bu klasör, **Tadilat Takip** web uygulamanızla **aynı Firebase veritabanına** (`ai-studio-84ad73bc-3066-4a3f-bd96-51d84f74f838`) bağlanan, yerel ve dinamik bir **Android Ana Ekran (Home Screen) Widget** projesidir.

---

## 📌 Özellikler
- **Gerçek Zamanlı Bağlantı:** Web uygulamasında yaptığınız şantiye ve görev değişiklikleri doğrudan telefonunuzun ana ekranındaki widget'a yansır.
- **Aktif Şantiye Özeti:** Üst barda aktif (Devam Eden/Planlanan) projelerinizin ve bekleyen görevlerinizin anlık toplam sayılarını gösterir.
- **Kişiselleştirilmiş Şantiye Listesi:** Yalnızca kendi kullanıcı hesabınıza (`userId`) ait bekleyen görevleri önem sırasına (Acil > Yüksek > Orta > Düşük) göre dizer.
- **Güvenli Kimlik Doğrulama:** Firestore güvenlik kurallarınızla uyumlu çalışır; kullanıcı e-posta ve şifresiyle oturum açma arayüzü sunar.
- **Manuel & Otomatik Güncelleme:** Widget üzerindeki "Yenile" butonu şantiye verilerini anında günceller. Ayrıca Android sistemi arka planda belirli aralıklarla otomatik senkronize eder.

---

## 🚀 Başlangıç ve Kurulum Adımları

### Adım 1: Projeyi Bilgisayarınıza İndirin
1. AI Studio arayüzündeki sağ üst menüden **Export / Zip** seçeneğini kullanarak tüm projeyi bilgisayarınıza `.zip` olarak indirin.
2. Sıkıştırılmış klasörü açın. İçindeki `android_widget_project` klasörünü masaüstünüze çıkartın.

### Adım 2: Firebase Console'da Android Uygulaması Ekleyin
Widget'ın doğrudan veritabanınıza bağlanabilmesi için kendi Firebase projenizde bu paketi kaydetmeniz gerekir:
1. [Firebase Console](https://console.firebase.google.com/) adresine gidin.
2. Web projenizin bulunduğu **`gen-lang-client-0717110256`** isimli Firebase projesini seçin.
3. Proje Genel Bakış sayfasında, orta kısımdaki **Android simgesine** tıklayarak yeni bir Android uygulaması ekleyin.
4. **Android Paket Adı:** `com.ustatakip.tadilat.widget` yazın.
5. Uygulamayı kaydedin ve Firebase tarafından oluşturulan **`google-services.json`** dosyasını indirin.

### Adım 3: İndirilen `google-services.json` Dosyasını Değiştirin
1. İndirdiğiniz gerçek `google-services.json` dosyasını kopyalayın.
2. `android_widget_project/app/` klasörünün içine yapıştırın (buradaki şablon dosyanın üzerine yazın).

### Adım 4: Android Studio ile Projeyi Açın
1. **Android Studio** programını açın.
2. **Open Existing Project** (Var Olan Projeyi Aç) seçeneğini seçin.
3. Çıkartmış olduğunuz `android_widget_project` klasörünü gösterip açın.
4. Android Studio'nun gerekli Gradle kütüphanelerini indirmesini (Build) bekleyin.

### Adım 5: Telefonunuzda Çalıştırın ve Giriş Yapın
1. Android telefonunuzu USB hata ayıklama moduyla bilgisayarınıza bağlayın ya da bir simülatör (Emulator) başlatın.
2. Yukarıdaki yeşil **Run** (Çalıştır) butonuna basın.
3. Uygulama telefonunuza yüklendiğinde bir **Giriş Ekranı** açılacaktır.
4. Web uygulamasında kullandığınız **E-posta ve Şifre** bilgilerini girerek giriş yapın.
    > **Neden Giriş Yapmalıyım?** Firestore güvenlik kurallarınız (`firestore.rules`), verileri sadece giriş yapmış yetkili kullanıcılara kapalı tutar. Giriş yaptıktan sonra widget güvenli bir şekilde sizin kimlik ID'nizi (`uid`) kullanarak doğru şantiyeleri filtreler.

### Adım 6: Ana Ekran Widget'ını Ekleyin
1. Telefonunuzun ana ekranında (Launcher) boş bir alana uzunca basılı tutun.
2. Pop-up menüden **Widgetlar** (Widgets) seçeneğine tıklayın.
3. Listeden **Tadilat Şantiye Yönetimi** (veya `Tadilat Takip Widget`) uygulamasını bulun.
4. Bulduğunuz widget'ı sürükleyip ekranınızda istediğiniz yere yerleştirin.
5. Boyutunu sağa-sola veya aşağı-yukarı esneterek listenizi daha geniş olacak şekilde ayarlayabilirsiniz!

---

## 🛠️ Teknik Altyapı Notları
- **RemoteViews & ListView:** Widget listesi, Android'in performans dostu `RemoteViewsService` yapısını kullanır. Bellek harcamadan binlerce görevi akıcı bir şekilde kaydırabilir.
- **Synchronous Tasks await:** Veriler çekilirken ana arayüzü kilitlememek adına işlemler arka plan iş parçacığında `Tasks.await(...)` komutuyla Coroutine içerisinde yürütülür.
- **Priority-Oriented Sorting:** Görevler çekildikten sonra Kotlin tarafında öncelik ağırlıklarına göre sıralanır ve önem derecesini belirten renkli badge'ler (etiketler) dinamik olarak atanır.
