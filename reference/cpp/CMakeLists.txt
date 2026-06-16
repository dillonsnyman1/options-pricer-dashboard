cmake_minimum_required(VERSION 3.14)
project(options_reference CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(test_options test_options.cpp)
target_include_directories(test_options PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_options(test_options PRIVATE -Wall -Wextra -O2)

enable_testing()
add_test(NAME options COMMAND test_options
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
