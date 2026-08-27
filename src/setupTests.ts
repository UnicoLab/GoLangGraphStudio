// Jest setup, picked up automatically by react-scripts.
//
// `@testing-library/jest-dom` adds the DOM matchers (`toBeInTheDocument`,
// `toHaveTextContent`, …) the component tests use to assert against real
// rendered output rather than against mocks.
import '@testing-library/jest-dom';

// jsdom implements no layout, so `Element.prototype.scrollIntoView` is simply
// missing. ChatView calls it from an effect to keep the newest message in
// view; without this stub every ChatView render throws in tests even though
// the code is correct in every real browser.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op: nothing to scroll in jsdom */
  };
}
