# 🚀 Инструкции по развертыванию Universal AI Chat

## 📋 Предварительные требования

### 1. Системные требования
- Node.js 18+ 
- npm или yarn
- Git
- Supabase CLI (опционально, для локальной разработки)

### 2. Аккаунты и сервисы
- [Supabase](https://supabase.com) - для базы данных и аутентификации
- [OpenAI](https://openai.com) - для API ключей GPT (опционально)
- [Anthropic](https://anthropic.com) - для API ключей Claude (опционально)

## 🏗 Пошаговое развертывание

### Шаг 1: Подготовка проекта

```bash
# Клонирование репозитория
git clone <your-repo-url>
cd UniversalAIChat

# Установка зависимостей
npm install
```

### Шаг 2: Настройка Supabase

#### 2.1 Создание проекта
1. Перейдите на [supabase.com](https://supabase.com)
2. Нажмите "New Project"
3. Выберите организацию
4. Введите название проекта (например: "universal-ai-chat")
5. Установите пароль для базы данных
6. Выберите регион (ближайший к вашим пользователям)
7. Нажмите "Create new project"

#### 2.2 Получение ключей
1. В настройках проекта найдите "API"
2. Скопируйте:
   - Project URL
   - anon public key

#### 2.3 Создание переменных окружения
Создайте файл `.env.local` в корне проекта:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Шаг 3: Настройка базы данных

#### 3.1 Применение миграций
1. В Supabase Dashboard перейдите в "SQL Editor"
2. Примените миграции по порядку:

```sql
-- 1. Базовая структура (20250823093010_...)
-- 2. Функции поиска (20250823093149_...)
-- 3. Новые поля и seed данные (20250823100000_...)
```

#### 3.2 Проверка таблиц
В "Table Editor" должны появиться:
- `profiles`
- `chats`
- `messages`
- `agents`
- `documents`
- `doc_chunks`
- `agent_conversations`
- `intent_classifications`

#### 3.3 Проверка seed данных
Убедитесь, что в таблицах есть тестовые данные:
- Тестовый пользователь
- 2 тестовых агента
- 2 тестовых чата
- Тестовый документ с чанками

### Шаг 4: Настройка Edge Functions

#### 4.1 Установка Supabase CLI
```bash
npm install -g supabase
```

#### 4.2 Логин в Supabase
```bash
supabase login
```

#### 4.3 Линковка проекта
```bash
supabase link --project-ref your-project-id
```

#### 4.4 Развертывание функций
```bash
supabase functions deploy
```

### Шаг 5: Настройка Storage

#### 5.1 Создание bucket для документов
В Supabase Dashboard:
1. Перейдите в "Storage"
2. Создайте bucket "documents"
3. Установите "Public" в false
4. Настройте RLS политики

#### 5.2 RLS политики для storage
```sql
-- Пользователи могут загружать свои документы
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Пользователи могут просматривать свои документы
CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Пользователи могут удалять свои документы
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### Шаг 6: Настройка аутентификации

#### 6.1 Настройка провайдеров
В Supabase Dashboard:
1. Перейдите в "Authentication" > "Providers"
2. Настройте Email provider
3. Опционально: настройте OAuth провайдеры (Google, GitHub)

#### 6.2 Настройка email шаблонов
1. В "Authentication" > "Email Templates"
2. Настройте шаблоны для:
   - Подтверждения email
   - Сброса пароля
   - Приглашений

### Шаг 7: Тестирование

#### 7.1 Локальный запуск
```bash
npm run dev
```

#### 7.2 Проверка функций
1. Откройте `http://localhost:5173`
2. Зарегистрируйтесь/войдите
3. Проверьте создание чатов
4. Проверьте загрузку документов
5. Проверьте мульти-агентные разговоры

### Шаг 8: Продакшн развертывание

#### 8.1 Сборка проекта
```bash
npm run build
```

#### 8.2 Развертывание на Vercel
1. Установите Vercel CLI: `npm i -g vercel`
2. Войдите: `vercel login`
3. Разверните: `vercel --prod`

#### 8.3 Развертывание на Netlify
1. Создайте `netlify.toml`:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"
```

2. Разверните через Netlify Dashboard или CLI

#### 8.4 Развертывание на GitHub Pages
1. В `vite.config.ts` добавьте:
```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ... остальные настройки
})
```

2. Настройте GitHub Actions для автоматического развертывания

## 🔧 Конфигурация для продакшна

### 1. Переменные окружения
```env
# Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# AI API Keys (опционально)
VITE_OPENAI_API_KEY=your-openai-key
VITE_ANTHROPIC_API_KEY=your-anthropic-key

# Аналитика (опционально)
VITE_ANALYTICS_ID=your-analytics-id
```

### 2. Настройка CORS
В Supabase Dashboard:
1. Перейдите в "Settings" > "API"
2. Добавьте домены в "Additional Allowed Origins"

### 3. Настройка мониторинга
```typescript
// src/main.tsx
if (import.meta.env.PROD) {
  // Инициализация аналитики
  // Sentry, LogRocket, etc.
}
```

## 🚨 Устранение неполадок

### Проблемы с базой данных
```bash
# Проверка статуса Supabase
supabase status

# Сброс локальной базы
supabase db reset

# Применение миграций заново
supabase db push
```

### Проблемы с Edge Functions
```bash
# Проверка логов
supabase functions logs

# Перезапуск функций
supabase functions deploy --no-verify-jwt
```

### Проблемы с аутентификацией
1. Проверьте RLS политики
2. Убедитесь в корректности JWT токенов
3. Проверьте настройки провайдеров

### Проблемы с загрузкой документов
1. Проверьте настройки Storage
2. Убедитесь в корректности RLS политик
3. Проверьте размеры файлов и лимиты

## 📊 Мониторинг и аналитика

### 1. Supabase Dashboard
- Мониторинг базы данных
- Логи Edge Functions
- Статистика аутентификации
- Мониторинг Storage

### 2. Внешние сервисы
- [Sentry](https://sentry.io) - мониторинг ошибок
- [LogRocket](https://logrocket.com) - сессии пользователей
- [Google Analytics](https://analytics.google.com) - аналитика

## 🔒 Безопасность

### 1. Проверка RLS политик
```sql
-- Проверка всех таблиц
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2. Аудит доступа
```sql
-- Включение логирования
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

### 3. Регулярные обновления
- Обновляйте зависимости: `npm audit fix`
- Проверяйте уязвимости: `npm audit`
- Обновляйте Supabase до последней версии

## 📈 Масштабирование

### 1. База данных
- Мониторинг производительности запросов
- Оптимизация индексов
- Партиционирование больших таблиц

### 2. Edge Functions
- Кэширование ответов
- Оптимизация размера функций
- Мониторинг времени выполнения

### 3. Storage
- CDN для статических файлов
- Оптимизация изображений
- Архивирование старых документов

---

**Успешного развертывания! 🎉**

При возникновении проблем обращайтесь к документации Supabase или создавайте Issues в репозитории проекта.
