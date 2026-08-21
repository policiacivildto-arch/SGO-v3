import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('redirects an unauthenticated user to the login screen', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const loginTitle = await screen.findByText(/acesso ao sistema/i);
  expect(loginTitle).toBeInTheDocument();
});
