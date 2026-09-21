import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the media library', () => {
  render(<App />);
  expect(screen.getByText('Your library')).toBeDefined();
  expect(screen.getAllByText('Dune: Part Two').length).toBeGreaterThan(0);
});

test('can pause the selected media while watching', () => {
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Play Dune: Part Two' })[0]);
  expect(screen.getAllByRole('button', { name: 'Pause Dune: Part Two' }).length).toBe(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Pause Dune: Part Two' })[0]);
  expect(screen.getAllByRole('button', { name: 'Play Dune: Part Two' }).length).toBeGreaterThan(0);
});

test('adds an MP4 from the local file picker', () => {
  render(<App />);
  const file = new File(['video data'], 'weekend-cut.mp4', { type: 'video/mp4' });

  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });

  expect(screen.getAllByText('weekend-cut').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: 'Play weekend-cut' }).length).toBeGreaterThan(0);
});

test('offers fullscreen mode for a local MP4', () => {
  const requestFullscreen = vi.fn(() => Promise.resolve());
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  render(<App />);
  const file = new File(['video data'], 'fullscreen-test.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });

  fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

  expect(requestFullscreen).toHaveBeenCalledTimes(1);
});

test('shows added MP4s in Downloads', () => {
  render(<App />);
  const file = new File(['video data'], 'saved-movie.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /Downloads/ }));

  expect(screen.getByRole('heading', { name: 'Downloads' })).toBeDefined();
  expect(screen.getAllByText('saved-movie').length).toBeGreaterThan(0);
});

test('opens the media actions menu', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Open menu for Dune: Part Two' }));

  expect(screen.getByRole('menu')).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Share' })).toBeDefined();
});

test('deletes an added MP4 from the visible library', async () => {
  render(<App />);
  const title = `remove-me-${Date.now()}`;
  const file = new File(['video data'], `${title}.mp4`, { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: `Open menu for ${title}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

  await waitFor(() => expect(screen.queryByRole('heading', { name: title })).toBeNull());
});

test('shows storage based on saved MP4 size', () => {
  render(<App />);
  const file = new File(['video data'], 'storage-check.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });

  expect(screen.getByText(/of .* used/)).toBeDefined();
});

test('seeks a local video with A and D keys', () => {
  render(<App />);
  const file = new File(['video data'], 'keyboard-seek.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });
  const video = document.querySelector('video');
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 30 });
  Object.defineProperty(video, 'duration', { configurable: true, value: 60 });

  fireEvent.keyDown(window, { key: 'd' });
  expect(video.currentTime).toBe(40);
  fireEvent.keyDown(window, { key: 'a' });
  expect(video.currentTime).toBe(30);
});

test('mutes and unmutes a local video with F', () => {
  render(<App />);
  const file = new File(['video data'], 'keyboard-mute.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Choose an MP4 video'), { target: { files: [file] } });
  const video = document.querySelector('video');

  fireEvent.keyDown(window, { key: 'f' });
  expect(video.muted).toBe(true);
  expect(screen.getByRole('button', { name: 'Unmute keyboard-mute' })).toBeDefined();
  fireEvent.keyDown(window, { key: 'f' });
  expect(video.muted).toBe(false);
});
