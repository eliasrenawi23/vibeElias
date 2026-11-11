import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

/** A "form" whose dirty flag is a button, with the three ways out a real form has. */
function FormPage({ failSave = false }: { failSave?: boolean }) {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChangesGuard(dirty);
  return (
    <div>
      <h1>Form page</h1>
      <button onClick={() => setDirty(true)}>type</button>
      <button onClick={() => setDirty(false)}>reset</button>
      <button onClick={() => navigate('/other')}>leave</button>
      <button onClick={() => guard.confirmDiscard(() => navigate('/other'))}>cancel</button>
      <button
        onClick={() =>
          void guard
            .submit(async () => {
              if (failSave) throw new Error('rejected');
              navigate('/other');
            })
            .catch(() => undefined)
        }
      >
        save
      </button>
      {guard.prompt}
    </div>
  );
}

function renderGuarded(failSave = false) {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <FormPage failSave={failSave} /> },
      { path: '/other', element: <h1>Other page</h1> },
    ],
    { initialEntries: ['/form'] },
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const dialogTitle = () => screen.queryByText(i18n.t('unsaved.title'));

/** A `beforeunload` that the page may cancel; true when it asked the browser to prompt. */
function unloadPrompts(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useUnsavedChangesGuard', () => {
  it('lets a clean form go without asking', async () => {
    renderGuarded();
    expect(unloadPrompts()).toBe(false);
    click('leave');
    expect(await screen.findByText('Other page')).toBeInTheDocument();
  });

  it('blocks leaving a dirty form until the user discards', async () => {
    const router = renderGuarded();
    click('type');
    expect(unloadPrompts()).toBe(true);

    click('leave');
    expect(await screen.findByText(i18n.t('unsaved.leave'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');

    // "Keep editing" stays on the form.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('unsaved.stay') }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/form'));

    click('leave');
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('unsaved.discard') }));
    expect(await screen.findByText('Other page')).toBeInTheDocument();
  });

  it('asks before a cancel throws input away', async () => {
    const router = renderGuarded();
    click('type');
    click('cancel');
    expect(await screen.findByText(i18n.t('unsaved.close'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('unsaved.discard') }));
    // The discard navigates: the blocker must not ask a second time.
    expect(await screen.findByText('Other page')).toBeInTheDocument();
  });

  it('releases after a successful save', async () => {
    renderGuarded();
    click('type');
    click('save');
    expect(await screen.findByText('Other page')).toBeInTheDocument();
    expect(dialogTitle()).toBeNull();
  });

  it('stays armed after a failed save', async () => {
    const router = renderGuarded(true);
    click('type');
    click('save');
    await waitFor(() => expect(unloadPrompts()).toBe(true));
    click('leave');
    expect(await screen.findByText(i18n.t('unsaved.leave'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');
  });

  it('stops guarding once the form is clean again', async () => {
    renderGuarded();
    click('type');
    click('reset');
    expect(unloadPrompts()).toBe(false);
    click('leave');
    expect(await screen.findByText('Other page')).toBeInTheDocument();
  });
});
