# Express TypeScript Jest Boilerplate

A modern Express.js application boilerplate with TypeScript and Jest integration, following best practices.

## Features

- Express.js with TypeScript integration
- Jest for testing
- ESLint for code linting
- Prettier for code formatting
- Morgan for HTTP request logging
- Helmet for security headers
- CORS enabled
- Type definitions and interfaces
- Error handling middleware
- Health check endpoint
- Hot reloading in development

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd express-typescript-jest
```

2. Install dependencies:

```bash
npm install
```

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reloading
- `npm run build` - Build the TypeScript code
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

## Project Structure

```
src/
├── __tests__/      # Test files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── routes/         # Application routes
├── services/      # Business logic
├── types/         # TypeScript type definitions
├── app.ts         # Express application setup
└── index.ts       # Application entry point
```

## Environment Variables

Create a `.env` file in the root directory and add the following variables:

```env
PORT=3000
NODE_ENV=development
```

## Testing

The project uses Jest for testing. Tests are located in the `src/__tests__` directory.

To run tests:

```bash
npm test
```

To run tests with coverage:

```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details
