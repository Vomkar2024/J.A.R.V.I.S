import { render, screen } from '@testing-library/react';
import App from './App';

test('renders J.A.R.V.I.S logo', () => {
  render(<App />);
  const logoElement = screen.getByText(/J\.A\.R\.V\.I\.S/i);
  expect(logoElement).toBeInTheDocument();
});
