// ============================================
// Subscribely Website JavaScript
// Vanilla JS - No Dependencies
// ============================================

(function() {
  'use strict';

  // ============================================
  // Mobile Menu Toggle
  // ============================================
  function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (menuToggle && navMenu) {
      menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        
        // Update ARIA attribute
        const isExpanded = navMenu.classList.contains('active');
        menuToggle.setAttribute('aria-expanded', isExpanded);
      });
      
      // Close menu when clicking on a link
      const navLinks = navMenu.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', function() {
          navMenu.classList.remove('active');
          menuToggle.setAttribute('aria-expanded', 'false');
        });
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', function(e) {
        if (!menuToggle.contains(e.target) && !navMenu.contains(e.target)) {
          navMenu.classList.remove('active');
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  // ============================================
  // Smooth Scrolling for Anchor Links
  // ============================================
  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Don't smooth scroll for # alone
        if (href === '#') return;
        
        const target = document.querySelector(href);
        
        if (target) {
          e.preventDefault();
          
          const headerOffset = 80; // Account for sticky header
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // ============================================
  // Pricing Toggle (Monthly/Annual)
  // ============================================
  function initPricingToggle() {
    const toggleSwitch = document.querySelector('.toggle-switch');
    const monthlyLabel = document.querySelector('.pricing-monthly-label');
    const annualLabel = document.querySelector('.pricing-annual-label');
    const monthlyPrices = document.querySelectorAll('.price-monthly');
    const annualPrices = document.querySelectorAll('.price-annual');
    
    if (!toggleSwitch) return;
    
    toggleSwitch.addEventListener('click', function() {
      const isAnnual = this.classList.toggle('active');
      
      // Update visual state
      if (monthlyLabel) monthlyLabel.style.fontWeight = isAnnual ? '400' : '700';
      if (annualLabel) annualLabel.style.fontWeight = isAnnual ? '700' : '400';
      
      // Show/hide prices
      monthlyPrices.forEach(price => {
        price.style.display = isAnnual ? 'none' : 'block';
      });
      
      annualPrices.forEach(price => {
        price.style.display = isAnnual ? 'block' : 'none';
      });
    });
  }

  // ============================================
  // FAQ Accordion
  // ============================================
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      
      if (question) {
        question.addEventListener('click', function() {
          // Close other items
          faqItems.forEach(otherItem => {
            if (otherItem !== item && otherItem.classList.contains('active')) {
              otherItem.classList.remove('active');
            }
          });
          
          // Toggle current item
          item.classList.toggle('active');
          
          // Update ARIA
          const isExpanded = item.classList.contains('active');
          question.setAttribute('aria-expanded', isExpanded);
        });
      }
    });
  }

  // ============================================
  // Active Navigation Link
  // ============================================
  function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
      const linkPage = link.getAttribute('href');
      
      if (linkPage === currentPage || 
          (currentPage === '' && linkPage === 'index.html') ||
          (currentPage === '/' && linkPage === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  // ============================================
  // Scroll Animations
  // ============================================
  function initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    // Observe feature cards, pricing cards, etc.
    const animatedElements = document.querySelectorAll(
      '.feature-card, .pricing-card, .faq-item'
    );
    
    animatedElements.forEach(el => {
      observer.observe(el);
    });
  }

  // ============================================
  // Form Validation (for support page)
  // ============================================
  function initFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        
        inputs.forEach(input => {
          if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
            showError(input, 'This field is required');
          } else {
            input.classList.remove('error');
            hideError(input);
          }
          
          // Email validation
          if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
              isValid = false;
              input.classList.add('error');
              showError(input, 'Please enter a valid email address');
            }
          }
        });
        
        if (isValid) {
          // Form is valid - show success message
          showSuccessMessage(form);
        }
      });
      
      // Clear error on input
      const inputs = form.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        input.addEventListener('input', function() {
          this.classList.remove('error');
          hideError(this);
        });
      });
    });
  }

  function showError(input, message) {
    let errorDiv = input.parentNode.querySelector('.error-message');
    
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      input.parentNode.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
  }

  function hideError(input) {
    const errorDiv = input.parentNode.querySelector('.error-message');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  function showSuccessMessage(form) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
      <h3>Thank you for contacting us!</h3>
      <p>Please email your message to <a href="mailto:support@subscribely.app">support@subscribely.app</a></p>
      <p>We'll get back to you within 24-48 hours.</p>
    `;
    
    form.innerHTML = '';
    form.appendChild(successDiv);
  }

  // ============================================
  // Copy to Clipboard (for support email)
  // ============================================
  function initCopyToClipboard() {
    const copyButtons = document.querySelectorAll('[data-copy]');
    
    copyButtons.forEach(button => {
      button.addEventListener('click', function() {
        const textToCopy = this.getAttribute('data-copy');
        
        // Modern clipboard API
        if (navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback(this);
          });
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = textToCopy;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showCopyFeedback(this);
        }
      });
    });
  }

  function showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }

  // ============================================
  // Keyboard Navigation Enhancement
  // ============================================
  function initKeyboardNav() {
    // Add keyboard support for custom interactive elements
    const interactiveElements = document.querySelectorAll(
      '.toggle-switch, .faq-question'
    );
    
    interactiveElements.forEach(element => {
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
      }
      
      element.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });
  }

  // ============================================
  // External Links (open in new tab)
  // ============================================
  function initExternalLinks() {
    const links = document.querySelectorAll('a[href^="http"]');
    
    links.forEach(link => {
      const url = new URL(link.href);
      
      // If it's not the current domain
      if (url.hostname !== window.location.hostname) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        
        // Add accessible label
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = ' (opens in new tab)';
        link.appendChild(srText);
      }
    });
  }

  // ============================================
  // Load Detection for Performance
  // ============================================
  function detectSlowConnection() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      if (connection.effectiveType === 'slow-2g' || 
          connection.effectiveType === '2g') {
        document.body.classList.add('slow-connection');
        console.log('Slow connection detected - optimizing experience');
      }
    }
  }

  // ============================================
  // Initialize All Features
  // ============================================
  function init() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    // Initialize all features
    initMobileMenu();
    initSmoothScroll();
    initPricingToggle();
    initFaqAccordion();
    updateActiveNavLink();
    initScrollAnimations();
    initFormValidation();
    initCopyToClipboard();
    initKeyboardNav();
    initExternalLinks();
    detectSlowConnection();
    
    console.log('Subscribely website initialized');
  }

  // Start initialization
  init();

  // ============================================
  // Public API (if needed)
  // ============================================
  window.Subscribely = {
    version: '1.0.0',
    init: init
  };

})();