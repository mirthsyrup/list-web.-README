# iOS-оболочка «Листа»

Это полный исходник небольшой оболочки UIKit/WebKit, собранной из Linux для
настоящего ARM64 iPhone/iPad. Xcode и Apple SDK не требуются: LLVM компилирует C,
а Objective-C runtime вызывает публичные API системных библиотек устройства.
Сгенерированные `.tbd` содержат только имена экспортируемых функций, без кода
Apple. Этот способ использовался и в исходной оболочке (LLD 18.1.3).

`List.c` загружает самодостаточный `web/ios-entry.html`, сохраняет прежний
`ru.seriylist.app` и `Application Support/List/state-v1.json`, восстанавливает
снимок до запуска JS и подтверждает атомарную запись по sequence. Экспорт —
системное меню UIKit; импорт и выбор фотографии — стандартные file inputs WK.
Сохраняются тема, статусная строка, альтернативная иконка и разрешение ProMotion.

`webkit.messageHandlers.haptic.postMessage({kind})` вызывает системные
UIImpactFeedbackGenerator/UINotificationFeedbackGenerator для урона, лечения,
броска, критических исходов и ошибки ввода. Только основная страница, активное
приложение, подключённая WebView и главный поток; повтор ограничен 120 мс.
Пользовательский выключатель проверяется веб-модулем до отправки команды.
Прямое управление вибромотором и приватные API не используются.

## Сборка

Нужны clang и ld64.lld с поддержкой ARM64, например LLVM 19. Debian-пакеты,
использованные для этой сборки, перечислены с SHA256 в `toolchain.lock.json`.
В Debian 13 x86_64 они распаковываются локально, без установки в систему:

```sh
python3 scripts/fetch_ios_llvm.py out/ios-tools
```

Пути к компилятору и линкеру находятся в `out/ios-tools/root/usr/bin/`;
runtime-lib — `out/ios-tools/root/usr/lib/x86_64-linux-gnu/`.

```sh
python3 scripts/build_ios_shell.py --out out/ios \
  --clang /path/to/clang-19 --linker /path/to/ld64.lld-19 \
  --runtime-lib /path/to/libclang-cpp-directory
python3 scripts/check_ios_native.py out/ios/List
python3 scripts/package_ios_shell.py --source /path/to/previous-reviewed.ipa \
  --binary out/ios/List --destination out/Лист-2.9.1.ipa \
  --version 2.9.1 --build 290
```

Скрипт проверяет архитектуру, iOS 16, системные зависимости и SHA256 каждой
страницы ad-hoc подписи. При упаковке иконки, юридические материалы и веб-часть
сохраняются; в HTML меняется только номер версии в «О приложении».
Для установки требуется привычное sideload-переподписывание, как для исходной IPA.

## Проверки

```sh
python3 -m pip install unicorn==2.1.4
python3 native/ios/tests/arm64_bridge.py out/ios/List --out out/ios/arm64-tests.json
```

Эмулятор исполняет **реальный собранный ARM64 код**, подменяя только системные
API. Проверены загрузка, точное восстановление Unicode-снимка, UIKit haptic
аргументы, отказ для неправильного контекста, debounce, атомарная запись,
ошибка записи, экспорт, тема, CGRect ABI и ограниченное восстановление процесса.
Это не запуск UIKit на настоящем iPhone и не проверка установки или силы вибрации.
