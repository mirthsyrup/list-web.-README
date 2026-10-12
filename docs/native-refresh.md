# Высокая частота экрана в приложениях

В 2.8.6 добавлен запрос высокой частоты экрана. Это дополняет оптимизацию общего
веб-интерфейса. Частота экрана и число кадров, которые успевает нарисовать WebView,
различаются: разрешение 120 Гц само по себе не устраняет тяжёлую анимацию.

## iOS

`Info.plist` содержит `CADisableMinimumFrameDurationOnPhone = true`.
Это разрешает системе использовать более высокую частоту на поддерживаемых
iPhone. Фактическая частота зависит от iOS, WebKit, энергосбережения, температуры
и настройки «Ограничение частоты кадров». Это не обещание постоянных 120 FPS.

Исполняемый файл iOS сохранён без изменений. В компактной IPA обновлены
`Info.plist`, единая HTML-страница с интерфейсом и сохранённые ресурсы сайта.
Пакет, как и исходная IPA, предназначен для обычной процедуры подписи при
установке через используемый владельцем способ sideload.

## Android

В Android нет аналога этого ключа из `Info.plist`. В исходной оболочке приложения
не было запроса режима экрана с высокой частотой. Теперь при `onResume()`:

- Выбирается самый быстрый поддерживаемый режим с тем же физическим разрешением.
- Режим передаётся системе через `WindowManager.LayoutParams.preferredDisplayModeId`.
- При энергосбережении предпочтение сбрасывается в `0`, управление остаётся ОС.
- Отсутствующий дисплей или исключение API производителя не блокируют приложение.

Это предпочтение ОС, а не принудительная частота. Оно не меняет разрешение,
не добавляет таймер на 120 кадров и не обходит системные ограничения. WebView и
настройки производителя могут сохранять более низкую частоту.

Исходный Android-проект в переданных файлах отсутствует. Изменение внесено в
проверенную оболочку 2.8.5 через smali: один новый класс и один вызов в `onResume`.
Java-эквивалент для переноса в исходный проект находится в
`scripts/android-refresh/HighRefresh.java`. Вызвать `HighRefresh.apply(this)`
нужно после `super.onResume()`. Используемые API существуют с Android 6 / API 23;
минимальная версия этого приложения — API 26.

## Повторяемая сборка

Выполнять команды из корня репозитория. Нужны Python 3, Java и инструменты
smali/baksmali 2.5.2. Зависимости скачиваются из Maven Central
(`https://repo.maven.apache.org/maven2/`):

| Группа | Артефакт | Версия |
| --- | --- | --- |
| org.smali | smali, baksmali, dexlib2, util | 2.5.2 |
| com.google.guava | guava | 27.1-android |
| com.beust | jcommander | 1.64 |
| org.antlr | antlr, antlr-runtime | 3.5.2 |
| org.antlr | stringtemplate | 3.2.1 |

Путь каждого JAR: `<группа с / вместо точек>/<артефакт>/<версия>/<артефакт>-<версия>.jar`.
Скрипт проверяет SHA-256 всех JAR и исходного DEX перед запуском. Значения
зафиксированы в `scripts/patch_android_refresh.py`; неизвестная оболочка
автоматически не исправляется. JAR и пакеты приложений не добавляются в Git.

```sh
python3 scripts/build_release.py --version 2.8.6 --out /tmp/list-release

python3 scripts/patch_android_refresh.py \
  --apk /path/List-2.8.5.apk \
  --tools-dir /path/smali-tools \
  --output /tmp/list-release/classes-refresh.dex

python3 scripts/prepare_mobile.py ios \
  --source /path/List-2.8.5-compact.ipa \
  --destination /tmp/list-release/List-2.8.6.ipa \
  --site site --version 2.8.6 --build 285 \
  --ios-entry /tmp/list-release/ios-entry.html

python3 scripts/prepare_mobile.py android \
  --source /path/List-2.8.5.apk \
  --destination /tmp/list-release/List-2.8.6-unsigned.apk \
  --site site --version 2.8.6 --build 285 \
  --android-dex /tmp/list-release/classes-refresh.dex
```

`-unsigned.apk` — заготовка для исходного процесса подписи, её нельзя установить
как готовое обновление. Любое изменение кода или веб-файлов APK делает прежнюю
подпись недействительной. Для обновления уже установленного приложения нужен
**тот же ключ подписи**, которым выпущена 2.8.5. Новый случайный ключ не подходит;
удалять установленное приложение ради такой подписи не нужно.

В исходном Android-процессе сборки нужно выровнять ZIP и подписать результат
существующим ключом, например через `zipalign` и `apksigner`, затем проверить
`apksigner verify --verbose --print-certs`. Сертификат новой и предыдущей версии
должен совпадать. Пароли и закрытые ключи не следует добавлять в репозиторий.

## Проверки и пределы

Скрипты проверяют целостность ZIP, совпадение веб-файлов с `site/`, точное
совпадение встроенной страницы iOS с результатом генератора и сохранность
всех остальных членов архива. Идентификаторы приложений, минимальные версии ОС,
разрешения, нативные функции сохранения и формат данных остаются прежними.
Версия — 2.8.6, номер сборки — 285.

Android DEX проходит сборку и обратную дизассемблировку: все девять исходных
классов совпадают, кроме явно добавленного вызова в `onResume`. Дополнительно
собранный DEX переведён в JVM-код через Enjarify: 10 классов, 0 ошибок.
Проверка JVM и девять сценариев с моделями Android API прошли: выбор частоты,
сохранение разрешения, 60-Гц дисплей, уже выбранные 120 Гц, отсутствие повторных
изменений окна, энергосбережение и возврат, отсутствующие окно/дисплей,
исключение производителя. Это не тестирование на реальном Android-устройстве.

На реальных iPhone/Android ещё требуется проверить установку с прежней подписью,
сохранённый лист, сворачивание «Умений», поворот экрана, импорт/экспорт,
энергосбережение и реальную частоту кадров. Измерения браузера на сервере не
доказывают 120 FPS на телефоне.

Справка:

- [Apple: CADisableMinimumFrameDurationOnPhone](https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone)
- [Android: preferredDisplayModeId](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#preferredDisplayModeId)
- [Android: PowerManager.isPowerSaveMode](https://developer.android.com/reference/android/os/PowerManager#isPowerSaveMode())
- [Android: подпись приложения](https://developer.android.com/studio/publish/app-signing)
