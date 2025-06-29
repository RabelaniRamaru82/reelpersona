import { useState } from 'react';

const ReelPersona = () => {
  const [activeSection, setActiveSection] = useState('about');

  const sections = [
    { id: 'about', label: 'About', icon: '👤' },
    { id: 'experience', label: 'Experience', icon: '💼' },
    { id: 'skills', label: 'Skills', icon: '🛠️' },
    { id: 'projects', label: 'Projects', icon: '🚀' },
    { id: 'contact', label: 'Contact', icon: '📧' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'about':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-4">About Me</h2>
            <p className="text-gray-300 leading-relaxed">
              Welcome to my interactive CV! I'm a passionate developer with expertise in modern web technologies.
              This ReelPersona showcases my professional journey and skills in an engaging format.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="glass-effect p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Location</h3>
                <p className="text-gray-300">Remote / Global</p>
              </div>
              <div className="glass-effect p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Experience</h3>
                <p className="text-gray-300">5+ Years</p>
              </div>
            </div>
          </div>
        );
      case 'experience':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-4">Experience</h2>
            <div className="space-y-6">
              <div className="glass-effect p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-white">Senior Developer</h3>
                <p className="text-blue-400 mb-2">Tech Company • 2022 - Present</p>
                <p className="text-gray-300">Leading development of modern web applications using React, TypeScript, and cloud technologies.</p>
              </div>
              <div className="glass-effect p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-white">Full Stack Developer</h3>
                <p className="text-blue-400 mb-2">Startup Inc • 2020 - 2022</p>
                <p className="text-gray-300">Built scalable web applications from concept to deployment, working with diverse tech stacks.</p>
              </div>
            </div>
          </div>
        );
      case 'skills':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-4">Skills</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker'].map((skill) => (
                <div key={skill} className="glass-effect p-4 rounded-lg text-center">
                  <span className="text-white font-medium">{skill}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'projects':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-4">Projects</h2>
            <div className="grid gap-6">
              <div className="glass-effect p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-white mb-2">ReelPersona CV</h3>
                <p className="text-gray-300 mb-4">Interactive CV builder with video integration and modern design.</p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">React</span>
                  <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm">TypeScript</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-4">Contact</h2>
            <div className="space-y-4">
              <div className="glass-effect p-4 rounded-lg flex items-center space-x-3">
                <span className="text-2xl">📧</span>
                <span className="text-white">contact@example.com</span>
              </div>
              <div className="glass-effect p-4 rounded-lg flex items-center space-x-3">
                <span className="text-2xl">💼</span>
                <span className="text-white">linkedin.com/in/yourprofile</span>
              </div>
              <div className="glass-effect p-4 rounded-lg flex items-center space-x-3">
                <span className="text-2xl">🐙</span>
                <span className="text-white">github.com/yourusername</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen gradient-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="glass-effect w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center">
              <span className="text-6xl">👨‍💻</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              John Developer
            </h1>
            <p className="text-xl text-gray-300">
              Full Stack Developer & Tech Enthusiast
            </p>
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`glass-effect px-6 py-3 rounded-lg transition-all duration-300 flex items-center space-x-2 ${
                  activeSection === section.id
                    ? 'bg-blue-600 bg-opacity-50 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="glass-effect p-8 rounded-xl">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReelPersona;