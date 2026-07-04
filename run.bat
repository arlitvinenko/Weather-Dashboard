@echo off
chcp 65001 >nul
title Погодный дашборд
echo ===================================
echo   Погодный дашборд (Weather Dashboard)
echo ===================================
echo.

:: Шаг 1: Проверка Python
echo [1] Проверка Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден!
    echo Установите Python 3.8 или выше и добавьте в PATH.
    echo Скачать: https://www.python.org/downloads/
    pause
    exit /b
)
echo [OK] Python найден.

:: Шаг 2: Проверка / создание виртуального окружения
set NEED_VENV=0
if exist venv\Scripts\python.exe (
    echo [2] Проверка venv...
    venv\Scripts\python -c "import flask" >nul 2>&1
    if errorlevel 1 (
        echo venv повреждён или библиотеки не установлены. Пересоздаю...
        rmdir /s /q venv
        set NEED_VENV=1
    ) else (
        echo [OK] venv работает.
    )
) else (
    echo [2] venv не найден. Создаю...
    set NEED_VENV=1
)

:: Шаг 3: Создание venv (если нужно)
if %NEED_VENV%==1 (
    echo [3] Создание venv...
    python -c "import venv" >nul 2>&1
    if errorlevel 1 (
        echo Модуль venv не найден. Использую virtualenv...
        python -m pip install virtualenv
        if errorlevel 1 (
            echo [ОШИБКА] Не удалось установить virtualenv.
            pause
            exit /b
        )
        virtualenv venv
    ) else (
        python -m venv venv
    )
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось создать venv.
        pause
        exit /b
    )
    echo [OK] venv создан.
)

:: Шаг 4: Установка зависимостей (только если venv был создан заново)
if %NEED_VENV%==1 (
    echo [4] Установка зависимостей...
    venv\Scripts\python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось установить зависимости.
        echo Проверьте интернет и файл requirements.txt.
        pause
        exit /b
    )
    echo [OK] Зависимости установлены.
) else (
    echo [4] Зависимости уже установлены.
)

:: Шаг 5: Проверка файлов
echo [5] Проверка файлов...
if not exist app.py (
    echo [ОШИБКА] Файл app.py не найден.
    echo Убедитесь, что run.bat лежит в папке с проектом.
    pause
    exit /b
)
echo [OK] app.py найден.

:: Шаг 6: Открытие браузера
echo [6] Открытие браузера...
start http://localhost:5000

:: Шаг 7: Запуск сервера (через python из venv)
echo [7] Запуск сервера (нажмите Ctrl+C для остановки)...
venv\Scripts\python app.py

:: Если сервер остановлен
echo.
echo Сервер остановлен.
pause