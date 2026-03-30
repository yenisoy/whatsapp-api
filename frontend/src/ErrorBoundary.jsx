import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Bilinmeyen frontend hatası"
    };
  }

  componentDidCatch(error) {
    console.error("Frontend runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          <h2>Frontend hata aldı</h2>
          <p>{this.state.message}</p>
          <p>Lütfen sayfayı yenileyin. Sorun devam ederse bu mesajı paylaşın.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
