describe('Theme Toggle', () => {
  beforeEach(() => {
    // Set up the DOM with all elements script.js expects
    document.body.innerHTML = `
      <button class="theme-toggle"></button>
      <button class="nav-toggle"></button>
      <nav class="main-nav"></nav>
      <div class="image-comparison-container">
        <div class="img-overlay-wrapper"></div>
        <img class="img-overlay">
        <div class="slider-thumb"></div>
      </div>
    `;
    document.body.className = '';
    jest.resetModules();
    require('./script.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should toggle to light theme on click when currently dark (default)', () => {
    const themeToggle = document.querySelector('.theme-toggle');

    // Simulate click
    themeToggle.click();

    // Assert light theme is enabled
    expect(document.body.classList.contains('light-theme')).toBe(true);
    expect(themeToggle.getAttribute('aria-pressed')).toBe('true');
    expect(themeToggle.getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  test('should toggle to dark theme on click when currently light', () => {
    // Setup light theme explicitly
    document.body.classList.add('light-theme');
    const themeToggle = document.querySelector('.theme-toggle');

    // Simulate click
    themeToggle.click();

    // Assert dark theme is enabled (light theme removed)
    expect(document.body.classList.contains('light-theme')).toBe(false);
    expect(themeToggle.getAttribute('aria-pressed')).toBe('false');
    expect(themeToggle.getAttribute('aria-label')).toBe('Switch to light mode');
  });

  test('should not throw error if elements are missing', () => {
    // Reset DOM completely
    document.body.innerHTML = '';
    jest.resetModules();

    // This should not throw an error thanks to optional chaining
    expect(() => require('./script.js')).not.toThrow();
  });
});
