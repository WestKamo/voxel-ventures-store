import React from "react";
import BreadCrumb from "../components/BreadCrumb";
import Meta from "../components/Meta";
import Container from "../components/Container";

const About = () => {
  return (
    <>
      <Meta title={"About Us"} />
      <BreadCrumb title="About Us" />
      <Container class1="about-wrapper py-5 home-wrapper-2">
        <div className="row">
          <div className="col-12">
            <div className="about-inner-wrapper">
              
              {/* Header Section */}
              <div className="about-header text-center mb-5">
                <h2 className="section-heading">Bridging Technology & Lifestyle</h2>
                <p className="fs-5 text-muted">
                  Welcome to Voxel Ventures, a premier hybrid digital and lifestyle agency based in Germiston, Gauteng.
                </p>
              </div>
              
              {/* Brand Story Section */}
              <div className="row mb-5 align-items-center">
                <div className="col-md-6">
                  {/* Optional placeholder for a workspace or brand image */}
                  <div 
                    className="rounded shadow-sm d-flex align-items-center justify-content-center bg-light" 
                    style={{ height: "300px", border: "1px solid #ddd" }}
                  >
                    <h4 className="text-secondary">Voxel Ventures</h4>
                  </div>
                </div>
                <div className="col-md-6 mt-4 mt-md-0">
                  <h3 className="mb-3">Our Unique Approach</h3>
                  <p>
                    Voxel Ventures was founded on a unique premise: the belief that rigorous technical engineering and creative lifestyle execution can thrive under one roof. We are not just a traditional storefront; we are a comprehensive service provider dedicated to delivering high-quality digital architectures, physical prototypes, and unforgettable event experiences.
                  </p>
                  <p>
                    Whether you need a data-driven digital solution containerized with Docker, an automated business workflow, a custom 3D-printed prototype, or artisan cakes for your next major corporate event, our diverse portfolio is equipped to handle it with absolute precision.
                  </p>
                </div>
              </div>

              {/* Founder & Tech Stack Section */}
              <div className="row mb-5 bg-white p-5 rounded shadow-sm">
                <div className="col-12 text-center mb-4">
                  <h3 className="mb-3">Meet the Founder</h3>
                </div>
                <div className="col-md-10 mx-auto text-center">
                  <h4 className="mb-2">Phindile Sandi</h4>
                  <h6 className="text-muted mb-4">
                    Data Analyst | Software Developer | Test Automation Engineer
                  </h6>
                  <p>
                    Armed with a Bachelor of Science in Information Technology from North West University, Phindile drives the technical vision of Voxel Ventures. With a deep focus on crafting robust data pipelines and scalable software, Phindile brings enterprise-grade expertise to every client project.
                  </p>
                  <p>
                    The core technical stack powering our digital services includes Python, Java, and SQL, complemented by advanced analytics and automation frameworks like Power BI, Tableau, Streamlit, and UiPath. This foundation ensures that every digital product we engineer is optimized for performance, scalability, and a seamless user experience.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </Container>
    </>
  );
};

export default About;
