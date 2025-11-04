# Regina Group Management

A comprehensive group management system built with React, TypeScript, and Supabase.

## Features

- **Real-time Messaging**: Instant messaging with popup notifications
- **Project Management**: Create, edit, and track project progress
- **Document Sharing**: Upload and share files with team members
- **User Management**: Admin features for user roles and permissions
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: Toggle between themes
- **Footer Editor**: Rich text editor with link insertion capabilities

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (Database, Auth, Storage, Real-time)
- **Routing**: React Router v6
- **UI Components**: Radix UI, Lucide React
- **Forms**: React Hook Form
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/felixon/regina-group-management.git
cd regina-group-management
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure Supabase:
   - Create a new Supabase project
   - Add your Supabase URL and API key to `.env.local`
   - Run the database migrations

5. Start the development server:
```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint

## Features in Detail

### Real-time Messaging
- Instant message delivery using Supabase real-time subscriptions
- Popup notifications for new messages
- Message status tracking (read/unread)
- File attachments support

### Footer Editor
- Rich text editing with formatting options
- Link insertion for selected text
- Color and style customization
- Save/preview functionality

### Project Management
- Create and edit projects
- Track project status and progress
- Assign team members
- Comment system

## Deployment

The application is configured for deployment on various platforms:

- **Vercel**: Zero-config deployment
- **Netlify**: Static site hosting
- **Traditional hosting**: Build and serve the `dist` folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.