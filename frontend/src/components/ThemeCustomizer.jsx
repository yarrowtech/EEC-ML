import React, { useState, useEffect } from 'react';
import { X, Settings, Check } from 'lucide-react';

const ThemeCustomizer = ({ onThemeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [skin, setSkin] = useState('light');
  const [contentWidth, setContentWidth] = useState('full');
  const [menuLayout, setMenuLayout] = useState('vertical');
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [menuHidden, setMenuHidden] = useState(false);
  const [rtlEnabled, setRtlEnabled] = useState(false);
  const [navbarColor, setNavbarColor] = useState('#6366f1');

  const navbarColors = [
    '#6366f1', // Purple
    '#6b7280', // Gray
    '#10b981', // Green
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#f59e0b', // Orange
    '#374151', // Dark Gray
  ];

  // Update the theme whenever any setting changes
  useEffect(() => {
    const themeConfig = {
      skin,
      contentWidth,
      menuLayout,
      menuCollapsed,
      menuHidden,
      rtlEnabled,
      navbarColor,
    };
    if (onThemeChange) {
      onThemeChange(themeConfig);
    }
  }, [skin, contentWidth, menuLayout, menuCollapsed, menuHidden, rtlEnabled, navbarColor, onThemeChange]);

  const handleSkinChange = (newSkin) => {
    setSkin(newSkin);
  };

  const handleContentWidthChange = (newWidth) => {
    setContentWidth(newWidth);
  };

  const handleMenuLayoutChange = (newLayout) => {
    setMenuLayout(newLayout);
  };

  const handleMenuCollapsedChange = () => {
    setMenuCollapsed((prev) => !prev);
  };

  const handleMenuHiddenChange = () => {
    setMenuHidden((prev) => !prev);
  };

  const handleRtlChange = () => {
    setRtlEnabled((prev) => !prev);
  };

  const handleNavbarColorChange = (newColor) => {
    setNavbarColor(newColor);
  };

  return (
    <>
      {/* Theme Customizer Panel */}
      {isOpen && (
        <div className="fixed right-0 top-0 w-full max-w-xs sm:w-80 sm:max-w-none h-full bg-white shadow-2xl border-l border-yellow-100 flex flex-col z-50">
          {/* Header */}
          <div className="p-4 border-b border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Theme Customizer</h2>
                <p className="text-sm text-gray-500">Customize & Preview in Real Time</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-yellow-100 rounded-lg transition-colors"
                aria-label="Close Theme Customizer"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* Skin */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Skin</h3>
              <div className="grid grid-cols-2 gap-2">
                {['light', 'bordered', 'dark', 'semi-dark'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSkinChange(option)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      skin === option
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-yellow-200'
                    }`}
                    aria-pressed={skin === option}
                  >
                    {option.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Width */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Content Width</h3>
              <div className="flex space-x-3">
                {['full', 'boxed'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleContentWidthChange(option)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      contentWidth === option
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-yellow-200'
                    }`}
                    aria-pressed={contentWidth === option}
                  >
                    {option} Width
                  </button>
                ))}
              </div>
            </div>

            {/* RTL */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">RTL</h3>
              <div className="flex items-center">
                <button 
                  onClick={handleRtlChange}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    rtlEnabled ? 'bg-yellow-500' : 'bg-gray-200'
                  }`}
                  aria-label={`Toggle RTL ${rtlEnabled ? 'off' : 'on'}`}
                  aria-checked={rtlEnabled}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                    rtlEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
                <span className="ml-3 text-sm text-gray-600">
                  {rtlEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Menu Layout */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Menu Layout</h3>
              <div className="flex space-x-3">
                {['vertical', 'horizontal'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleMenuLayoutChange(option)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      menuLayout === option
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-yellow-200'
                    }`}
                    aria-pressed={menuLayout === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Collapsed */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Menu Collapsed</h3>
              <div className="flex items-center">
                <button 
                  onClick={handleMenuCollapsedChange}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    menuCollapsed ? 'bg-yellow-500' : 'bg-gray-200'
                  }`}
                  aria-label={`Toggle Menu Collapsed ${menuCollapsed ? 'off' : 'on'}`}
                  aria-checked={menuCollapsed}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                    menuCollapsed ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
                <span className="ml-3 text-sm text-gray-600">
                  {menuCollapsed ? 'Collapsed' : 'Expanded'}
                </span>
              </div>
            </div>

            {/* Menu Hidden */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Menu Hidden</h3>
              <div className="flex items-center">
                <button 
                  onClick={handleMenuHiddenChange}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    menuHidden ? 'bg-yellow-500' : 'bg-gray-200'
                  }`}
                  aria-label={`Toggle Menu Hidden ${menuHidden ? 'off' : 'on'}`}
                  aria-checked={menuHidden}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                    menuHidden ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
                <span className="ml-3 text-sm text-gray-600">
                  {menuHidden ? 'Hidden' : 'Visible'}
                </span>
              </div>
            </div>

            {/* Navbar Color */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Navbar Color</h3>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                {navbarColors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleNavbarColorChange(color)}
                    className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg transition-all hover:scale-110 relative ${
                      navbarColor === color 
                        ? 'ring-2 ring-yellow-500 ring-offset-2' 
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Color ${index + 1}`}
                    aria-label={`Select Navbar Color ${index + 1}`}
                  >
                    {navbarColor === color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-yellow-500 text-black p-3 rounded-l-lg shadow-lg hover:bg-yellow-600 transition-colors z-40"
          title="Open Theme Customizer"
          aria-label="Open Theme Customizer"
        >
          <Settings size={20} />
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        ></div>
      )}
    </>
  );
};

export default ThemeCustomizer;