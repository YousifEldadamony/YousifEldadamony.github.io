const fs = require('fs');
const path = require('path');

// We are going to test the logic that deals with sliderThumb keydown events.

describe('Slider Keyboard Navigation', () => {
  let container, sliderThumb, overlayWrapper, overlayImage;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="image-comparison-container">
        <div class="img-overlay-wrapper" style="width: 50%;">
          <img class="img-overlay" src="test.jpg" />
        </div>
        <div class="slider-thumb" role="slider" aria-valuenow="50" style="left: 50%;" tabindex="0"></div>
      </div>
    `;

    // Re-evaluate script to bind event listeners to the newly created elements
    jest.resetModules();
    require('./script.js');

    container = document.querySelector('.image-comparison-container');
    sliderThumb = document.querySelector('.slider-thumb');
    overlayWrapper = document.querySelector('.img-overlay-wrapper');
    overlayImage = document.querySelector('.img-overlay');
  });

  it('moves slider 5% to the right on ArrowRight', () => {
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sliderThumb.style.left).toBe('55%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('55');
  });

  it('moves slider 5% to the left on ArrowLeft', () => {
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(sliderThumb.style.left).toBe('45%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('45');
  });

  it('moves slider to 0% on Home', () => {
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(sliderThumb.style.left).toBe('0%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('0');
  });

  it('moves slider to 100% on End', () => {
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(sliderThumb.style.left).toBe('100%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('100');
  });

  it('does not move beyond 100% on ArrowRight', () => {
    sliderThumb.style.left = '98%';
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sliderThumb.style.left).toBe('100%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('100');
  });

  it('does not move beyond 0% on ArrowLeft', () => {
    sliderThumb.style.left = '2%';
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(sliderThumb.style.left).toBe('0%');
    expect(sliderThumb.getAttribute('aria-valuenow')).toBe('0');
  });

  it('ignores keydown if role is not slider', () => {
    sliderThumb.removeAttribute('role');
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sliderThumb.style.left).toBe('50%'); // unchanged
  });

  it('moves to 5% from 0% on ArrowRight (verifying bug fix)', () => {
    sliderThumb.style.left = '0%';
    sliderThumb.setAttribute('aria-valuenow', '0');
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sliderThumb.style.left).toBe('5%');
  });

  it('moves to 95% from 100% on ArrowLeft', () => {
    sliderThumb.style.left = '100%';
    sliderThumb.setAttribute('aria-valuenow', '100');
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(sliderThumb.style.left).toBe('95%');
  });

  it('defaults to 50% if style.left is invalid', () => {
    sliderThumb.style.left = 'invalid';
    sliderThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sliderThumb.style.left).toBe('55%');
  });
});
