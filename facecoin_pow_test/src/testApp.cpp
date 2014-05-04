#include "ofAppRunner.h"
#include "testApp.h"

#include <cassert>
#include <string>
#include <sstream>

#include <openssl/sha.h>

static const int SCALED_UP_BITMAP_SIZE = 64;
static const int FONT_SIZE = 10;

/*int pixel1Bit(int x, int y, const unsigned char digest[SHA256_DIGEST_LENGTH]) {
    int byte_index = (x + (y * 16)) / 8;
    int bit_index = (x + (y * 16)) % 8;
    assert(byte_index < SHA256_DIGEST_LENGTH);
    assert(bit_index <= 8);
    int grey = ((digest[byte_index] >> bit_index) & 0x01) * 255;
    return grey;
    }*/

int pixel4Bit(int x, int y, const unsigned char digest[SHA256_DIGEST_LENGTH]) {
    int byte_index = (x + (y * 8)) / 2;
    assert(byte_index < SHA256_DIGEST_LENGTH);
    unsigned char byte = digest[byte_index];
    int grey = 0;
    if((x + (y * 8)) % 2) {
        grey = (byte & 0x0F) * 8;
    } else {
        grey = (byte >> 4) * 8;
    }
    return grey;
    }

void sha256(const unsigned char * src, size_t length, unsigned char digest[SHA256_DIGEST_LENGTH]) {
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    SHA256_Update(&sha256, src, length);
    SHA256_Final(digest, &sha256);
}

/*void drawSha256Depth1(int x, int y, const unsigned char digest[SHA256_DIGEST_LENGTH], float scale) {
    for(int y_index = 0; y_index < 16; y_index++) {
        for(int x_index = 0; x_index < 16; x_index++) {
            int grey = pixel1Bit(x_index, y_index, digest);
            ofSetColor(grey, grey, grey);
            ofRect(x + (x_index * scale), y + (y_index * scale), scale, scale);
        }
    }
} 

void drawSha256Depth4(int x, int y, const unsigned char digest[SHA256_DIGEST_LENGTH], float scale) {
    for(int y_index = 0; y_index < 8; y_index++) {
        for(int x_index = 0; x_index < 8; x_index++) {
            int grey = pixel4Bit(x_index, y_index, digest);
            ofSetColor(grey, grey, grey);
            ofRect(x + (x_index * scale), y + (y_index * scale), scale, scale);
        }
    }
    }*/

void print_digest(const unsigned char digest[SHA256_DIGEST_LENGTH]) {
    for(int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        printf("%x", (int)digest[i]);
    }
    printf("\n");
}

void digest_to_string(const unsigned char digest[SHA256_DIGEST_LENGTH],
                      std::string & str) {
    std::stringstream stream;
    for(int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        stream << std::hex << (int)digest[i];
    }
    str = stream.str();
}

unsigned char digest[SHA256_DIGEST_LENGTH];

#include <opencv2/objdetect/objdetect.hpp>
#include <opencv2/imgproc/imgproc.hpp>
// ONLY FOR TESTING!
//#include <opencv2/highgui/highgui.hpp>

static const char * FACE_CASCADE_FILENAME = "/usr/share/opencv/haarcascades/haarcascade_frontalface_default.xml";

cv::CascadeClassifier face_cascade;

void loadFaceCascade() {
    if (!face_cascade.load(FACE_CASCADE_FILENAME)) {
        printf("Error loading %s\n", FACE_CASCADE_FILENAME);
        exit (-1);
    }
}

void toFace4(const unsigned char digest[SHA256_DIGEST_LENGTH], cv::Mat & gray) {
    for(int y = 0; y < 8; y++) {
        for(int x = 0; x < 8; x++) {
            // Different row/column orders.
            gray.at<char>(y, x) = pixel4Bit(x, y, digest);
        }
    }
}

/*void drawMat8(const cv::Mat & mat, float scale) {
    // Different row/column order.
    for(int y_index = 0; y_index < mat.cols; y_index++) {
        for(int x_index = 0; x_index < mat.rows; x_index++) {
            int grey = mat.at<unsigned char>(y_index, x_index);
            ofSetColor(grey, grey, grey);
            ofRect(x_index * scale, y_index * scale, scale, scale);
        }
    }
    }*/

void drawMat(const cv::Mat & mat, int width, int height) {
    ofTexture tex;
    int w = mat.cols;
    int h = mat.rows;
    tex.allocate(w, h, GL_LUMINANCE);
    tex.loadData(mat.ptr(), w, h, GL_LUMINANCE);
    tex.setTextureMinMagFilter(GL_NEAREST, GL_NEAREST);
    tex.draw(0, 0, width, height);
}

cv::Mat big_gray;

bool findFace(const unsigned char digest[SHA256_DIGEST_LENGTH], cv::Mat & gray, cv::Rect & face_bounds) {
    toFace4(digest, gray);
    cv::resize(gray, big_gray, cv::Size(SCALED_UP_BITMAP_SIZE, SCALED_UP_BITMAP_SIZE), 0, 0, cv::INTER_LANCZOS4);
    cv::equalizeHist(big_gray, big_gray);
    std::vector<cv::Rect> faces;
    face_cascade.detectMultiScale(big_gray, faces, 1.05, 6);
    cv::Rect largest;
    int largest_area = 0;
    for(auto const& face : faces) {
        cv::Size rect_size = face.size();
        int area = rect_size.height * rect_size.width;
        if(area > largest_area){
            largest = face;
            largest_area = area;
        }
    }
    bool found = largest_area > 0;
    if(largest_area) {
        face_bounds = largest;
    }
    return found;
}

void describe(std::string & output, const unsigned char digest[SHA256_DIGEST_LENGTH], int nonce,
              bool found, const cv::Rect & face_bounds) {
    std::stringstream stream;
    std::string digest_str;
    digest_to_string(digest, digest_str);
    stream << "Hash:  " << digest_str << "\n"
           << "Nonce: " << nonce << "\n";
    if(found) {
        stream << "Face: " << face_bounds.x << "," << face_bounds.y
               << "->" << face_bounds.width << "x" << face_bounds.height
               << "\n";
    }
    output = stream.str();
}

unsigned long long nonce = 0;

ofTrueTypeFont myfont;

cv::Mat face_mat(8, 8, CV_8U);
bool found_face = false;
cv::Rect face_rect;

int draw_size;
int draw_scale;
int draw_offset_x;
int draw_offset_y;

//--------------------------------------------------------------
void testApp::setup(){
    memset(digest, 0, SHA256_DIGEST_LENGTH);
    loadFaceCascade();

    myfont.loadFont("arial.ttf", FONT_SIZE);

    draw_size = ofGetHeight() * 0.75;
    draw_offset_x = ofGetWidth() / 2 - draw_size / 2;
    draw_offset_y = ofGetHeight() / 2 - draw_size / 2;
    draw_scale = draw_size / SCALED_UP_BITMAP_SIZE;

    ofHideCursor();
}

//--------------------------------------------------------------
void testApp::update(){
    if(found_face) {
        ofSleepMillis(10 * 1000);
    }
    
    sha256(reinterpret_cast<unsigned char *>(&nonce), 8, digest);
    found_face = findFace(digest, face_mat, face_rect);
    
    nonce++;
}

//--------------------------------------------------------------

void testApp::draw(){
    ofTranslate(draw_offset_x, draw_offset_y);

    std::string description;
    describe(description, digest, nonce, found_face, face_rect);
    myfont.drawString(description.c_str(),
                      0, draw_size + FONT_SIZE + 10);

    ofSetColor(255, 255, 255);
    drawMat(big_gray, draw_size, draw_size);
    if(found_face) {
        ofNoFill();
        ofSetColor(0, 255, 0);
        ofRect(face_rect.x * draw_scale, face_rect.y * draw_scale,
               face_rect.width * draw_scale, face_rect.height * draw_scale);
    }
}

//--------------------------------------------------------------
void testApp::keyPressed(int key){

}

//--------------------------------------------------------------
void testApp::keyReleased(int key){

}

//--------------------------------------------------------------
void testApp::mouseMoved(int x, int y ){

}

//--------------------------------------------------------------
void testApp::mouseDragged(int x, int y, int button){

}

//--------------------------------------------------------------
void testApp::mousePressed(int x, int y, int button){

}

//--------------------------------------------------------------
void testApp::mouseReleased(int x, int y, int button){

}

//--------------------------------------------------------------
void testApp::windowResized(int w, int h){

}

//--------------------------------------------------------------
void testApp::gotMessage(ofMessage msg){

}

//--------------------------------------------------------------
void testApp::dragEvent(ofDragInfo dragInfo){ 

}
